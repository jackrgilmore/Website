;;; publish.el --- Turn the site's Org files into web pages -*- lexical-binding: t; -*-

;; What this builds:
;;
;;   content/writing/*.org           ->  writing/*.html  + data/writing.json
;;   ~/org/roam/**/*.org             ->  garden/*.html   + data/garden.json
;;   (only notes with the filetag :publish:)
;;
;; The animation and comics pages don't need this: the site reads
;; content/animation.org and content/comics.org directly in the browser.
;;
;; Run it from Emacs with M-x jg-site-publish (Doom: SPC n w p), or from a
;; terminal in this folder with:
;;
;;   emacs --batch -l publish.el -f jg-site-publish
;;
;; writing/ and garden/ hold generated pages: each publish deletes the .html
;; files in them and writes them fresh, so edit the Org files, not the HTML.

(require 'cl-lib)
(require 'ox-html)
(require 'json)
(require 'seq)
(require 'subr-x)
(require 'url-util)

(defvar jg-site-root
  (file-name-directory (or load-file-name buffer-file-name))
  "The website repository (the folder this file is in).")

(defvar jg-site-roam-directory (expand-file-name "~/org/roam/")
  "Where org-roam notes live. Only notes tagged `jg-site-publish-tag' go online.")

(defvar jg-site-publish-tag "publish"
  "The filetag that makes an org-roam note public.")

(defvar jg-site-type-labels
  '(("story" . "Short story") ("poem" . "Poem") ("essay" . "Essay")
    ("article" . "Article") ("script" . "Script") ("blog" . "Blog post"))
  "How each #+type: is shown above a piece's title.")

(defconst jg-site--image-re "\\.\\(png\\|jpe?g\\|gif\\|webp\\|svg\\)\\'")

;; Filled in by `jg-site-publish' while it runs, so links can be rewritten
(defvar jg-site--id-urls nil "org-roam ID -> URL of its published page.")
(defvar jg-site--file-urls nil "Org file (truename) -> URL of its published page.")
(defvar jg-site--backlinks nil "Page URL -> list of (TITLE . URL) linking to it.")


;;; Reading Org files

(defun jg-site--keywords (file)
  "Return FILE's #+KEYWORD: values as an alist with downcased keys."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (let ((case-fold-search t) result)
      (while (re-search-forward "^#\\+\\([a-z_]+\\):[ \t]*\\(.*?\\)[ \t]*$" nil t)
        (push (cons (downcase (match-string 1)) (match-string 2)) result))
      (nreverse result))))

(defun jg-site--kw (keywords name)
  "The value of keyword NAME in KEYWORDS, or nil if it's missing or blank."
  (let ((value (cdr (assoc name keywords))))
    (and value (not (string-empty-p value)) value)))

(defun jg-site--date (string)
  "The YYYY-MM-DD in STRING (\"2026-10-25\" or \"<2026-10-25 Sun>\"), or nil."
  (and string (string-match "[0-9]\\{4\\}-[0-9]\\{2\\}-[0-9]\\{2\\}" string)
       (match-string 0 string)))

(defun jg-site--pretty-date (iso)
  "Format ISO (YYYY-MM-DD) as \"October 25, 2026\"."
  (and iso (format-time-string "%B %-d, %Y" (date-to-time (concat iso " 12:00")))))

(defun jg-site--word-count (file)
  "Words in FILE's text, not counting #+ keyword lines or property drawers."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (flush-lines "^[ \t]*\\(#\\+\\|:[A-Za-z_]+:\\)")
    (count-words (point-min) (point-max))))

(defun jg-site--url (dir file)
  "The site URL of FILE's page in DIR."
  (format "/%s/%s.html" dir (url-hexify-string (file-name-base file))))

(defun jg-site--slug (title)
  "TITLE made safe for a URL: \"First Node!\" -> \"first-node\"."
  (let ((slug (string-trim (replace-regexp-in-string "[^a-z0-9]+" "-" (downcase title))
                           "-+" "-+")))
    (if (string-empty-p slug) "note" slug)))

(defun jg-site--writing ()
  "Every non-draft piece in content/writing/, as alists, newest first."
  (let ((dir (expand-file-name "content/writing/" jg-site-root)) pieces)
    (dolist (file (and (file-directory-p dir)
                       (directory-files dir t "\\`[^.#].*\\.org\\'")))
      (let ((kw (jg-site--keywords file)))
        (unless (member (downcase (or (jg-site--kw kw "draft") "")) '("t" "yes" "true"))
          (push `((title . ,(or (jg-site--kw kw "title") (file-name-base file)))
                  (type . ,(downcase (or (jg-site--kw kw "type") "blog")))
                  (publication . ,(or (jg-site--kw kw "publication") ""))
                  (date . ,(or (jg-site--date (jg-site--kw kw "date")) ""))
                  (description . ,(or (jg-site--kw kw "description") ""))
                  (words . ,(jg-site--word-count file))
                  (url . ,(jg-site--url "writing" file))
                  (file . ,file))
                pieces))))
    (sort pieces (lambda (a b) (string> (alist-get 'date a) (alist-get 'date b))))))

(defun jg-site--notes ()
  "Every org-roam note tagged `jg-site-publish-tag', as alists."
  (let (notes)
    (dolist (file (and (file-directory-p jg-site-roam-directory)
                       (directory-files-recursively jg-site-roam-directory "\\`[^.#].*\\.org\\'")))
      (let* ((kw (jg-site--keywords file))
             (tags (split-string (or (jg-site--kw kw "filetags") "") ":" t "[ \t]+")))
        (when (member jg-site-publish-tag tags)
          (with-temp-buffer
            (let ((coding-system-for-read 'utf-8))
              (insert-file-contents file))
            (let (ids)
              (while (re-search-forward "^[ \t]*:ID:[ \t]+\\(\\S-+\\)" nil t)
                (push (match-string 1) ids))
              (push `((title . ,(or (jg-site--kw kw "title") (file-name-base file)))
                      (tags . ,(remove jg-site-publish-tag tags))
                      (ids . ,ids)
                      (file . ,file))
                    notes))))))
    ;; Each page is named after its title, not its file (org-roam's file names
    ;; start with a timestamp). Two notes with the same title: the second gets -2.
    (let ((taken (make-hash-table :test #'equal)))
      (mapcar (lambda (note)
                (let* ((base (jg-site--slug (alist-get 'title note)))
                       (slug base)
                       (n 1))
                  (while (gethash slug taken)
                    (setq n (1+ n) slug (format "%s-%d" base n)))
                  (puthash slug t taken)
                  (cons (cons 'url (format "/garden/%s.html" slug)) note)))
              (nreverse notes)))))


;;; The HTML export backend

(org-export-define-derived-backend 'jg-site 'html
  :options-alist '((:jg-type "TYPE" nil nil t)
                   (:jg-publication "PUBLICATION" nil nil t))
  :translate-alist '((template . jg-site--template)
                     (link . jg-site--link)))

(defun jg-site--escape (string)
  "STRING with HTML tags removed and &, <, > and quotes escaped."
  (thread-last (replace-regexp-in-string "<[^>]+>" "" (or string ""))
               (replace-regexp-in-string "&" "&amp;")
               (replace-regexp-in-string "<" "&lt;")
               (replace-regexp-in-string ">" "&gt;")
               (replace-regexp-in-string "\"" "&quot;")))

(defun jg-site--copy-media (file info)
  "Copy image FILE next to the page being exported; return its relative URL."
  (let ((dir (expand-file-name "media/" (plist-get info :jg-out-dir))))
    (make-directory dir t)
    (copy-file file (expand-file-name (file-name-nondirectory file) dir) t)
    (concat "media/" (url-hexify-string (file-name-nondirectory file)))))

(defun jg-site--link (link desc info)
  "Export LINK. Links to pages that aren't published become plain text, so a
public note never points at (or reveals the location of) a private one."
  (let ((type (org-element-property :type link))
        (path (org-element-property :path link)))
    (pcase type
      ("id"
       (let ((url (gethash path jg-site--id-urls)))
         (if url
             (format "<a href=\"%s\">%s</a>" url (or desc (jg-site--escape path)))
           (or desc ""))))
      ("file"
       (let* ((input (plist-get info :input-file))
              (file (expand-file-name path (and input (file-name-directory input))))
              (page (and (file-exists-p file)
                         (gethash (file-truename file) jg-site--file-urls))))
         (cond ((and (string-match-p jg-site--image-re file) (file-exists-p file))
                (let ((src (jg-site--copy-media file info)))
                  (if desc
                      (format "<a href=\"%s\">%s</a>" src desc)
                    (format "<img src=\"%s\" alt=\"\">" src))))
               (page (format "<a href=\"%s\">%s</a>" page (or desc page)))
               (t (or desc "")))))
      (_ (org-html-link link desc info)))))

(defun jg-site--template (contents info)
  "Wrap the exported CONTENTS in the site's page layout."
  (let* ((kind (plist-get info :jg-kind))
         (title (org-export-data (plist-get info :title) info))
         (input (plist-get info :input-file))
         (kw (and input (jg-site--keywords input)))
         (type (downcase (or (plist-get info :jg-type) "blog")))
         (eyebrow (if (eq kind 'garden)
                      "Garden note"
                    (or (cdr (assoc type jg-site-type-labels)) (capitalize type))))
         (byline (string-join
                  (seq-remove #'string-empty-p
                              (delq nil (list (jg-site--escape (plist-get info :jg-publication))
                                  (jg-site--pretty-date
                                   (jg-site--date (jg-site--kw kw "date"))))))
                  " · "))
         (description (jg-site--escape (plist-get info :description)))
         (url (plist-get info :jg-url))
         (backlinks (and url (gethash url jg-site--backlinks))))
    (concat
     "<!DOCTYPE html>
<html lang=\"en\">
<head>
<meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
<title>" (jg-site--escape title) " — Jack Gilmore</title>
"    (if (string-empty-p description) ""
       (format "<meta name=\"description\" content=\"%s\">\n" description))
     "<script src=\"/theme.js\"></script>
<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
<link href=\"https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400..700;1,400..700&display=swap\" rel=\"stylesheet\">
<link rel=\"stylesheet\" href=\"/site.css\">
<script src=\"/nav.js\" defer></script>
</head>
<body>
<main class=\"page page-narrow\">
"    ;; Breadcrumbs: Garden / this note, or Read / Blog (or Writing) / this piece
     "<nav class=\"crumbs\" aria-label=\"Breadcrumb\">"
     (cond ((eq kind 'garden) "<a href=\"/garden.html\">Garden</a>")
           ((equal type "blog") "<a href=\"/read.html\">Read</a><a href=\"/read.html#blog\">Blog</a>")
           (t "<a href=\"/read.html\">Read</a><a href=\"/read.html#writing\">Writing</a>"))
     "<span aria-current=\"page\">" title "</span></nav>\n"
     "<article class=\"prose\">
<header class=\"prose-head\">
<p class=\"eyebrow\">" eyebrow "</p>
<h1>" title "</h1>
"    (if (string-empty-p byline) "" (format "<p class=\"byline\">%s</p>\n" byline))
     "</header>
" contents "
</article>
"    (if (not backlinks) ""
       (concat "<aside class=\"backlinks\">\n<h2>Linked from</h2>\n<ul>\n"
               (mapconcat (lambda (b) (format "<li><a href=\"%s\">%s</a></li>"
                                              (cdr b) (jg-site--escape (car b))))
                          backlinks "\n")
               "\n</ul>\n</aside>\n"))
     "</main>
</body>
</html>
")))

(defun jg-site--export (file url kind)
  "Export Org FILE as the page at site URL, a KIND page (writing or garden)."
  (let* ((org-inhibit-startup t)
         (out-file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
         (out-dir (file-name-directory out-file))
         (visiting (find-buffer-visiting file))
         (buffer (or visiting (let ((coding-system-for-read 'utf-8))
                                (find-file-noselect file)))))
    (unwind-protect
        (with-current-buffer buffer
          (org-export-to-file 'jg-site out-file
            nil nil nil nil (list :jg-kind kind :jg-out-dir out-dir :jg-url url)))
      (unless visiting (kill-buffer buffer)))))


;;; Publishing

(defun jg-site--page-links (file)
  "URLs of the published pages that FILE links to, through id: or file: links.
Links to anything unpublished (private notes, drafts) are left out."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (let ((dir (file-name-directory file)) urls)
      ;; [[id:ID]], [[id:ID][desc]], [[file:PATH]], [[file:PATH::search][desc]]
      (while (re-search-forward "\\[\\[\\(id\\|file\\):\\([^]]+?\\)\\(?:::[^]]*\\)?\\]" nil t)
        (let* ((path (match-string 2))
               (target (if (equal (match-string 1) "id")
                           (gethash path jg-site--id-urls)
                         (let ((linked (expand-file-name path dir)))
                           (and (file-exists-p linked)
                                (gethash (file-truename linked) jg-site--file-urls))))))
          (when target (cl-pushnew target urls :test #'equal))))
      (nreverse urls))))

(defun jg-site--write-json (file data)
  "Write DATA as pretty JSON to FILE (relative to the site root)."
  (let ((path (expand-file-name file jg-site-root))
        (json-encoding-pretty-print t)
        (coding-system-for-write 'utf-8))
    (make-directory (file-name-directory path) t)
    (with-temp-file path
      (insert (json-encode data) "\n"))))

(defun jg-site--clean (dir)
  "Delete the generated .html pages in DIR (relative to the site root)."
  (let ((path (expand-file-name dir jg-site-root)))
    (make-directory path t)
    (dolist (file (directory-files path t "\\.html\\'"))
      (delete-file file))))

(defun jg-site-publish ()
  "Export the writing and public garden notes, and write their indexes."
  (interactive)
  (let* ((writing (jg-site--writing))
         (notes (jg-site--notes))
         (jg-site--id-urls (make-hash-table :test #'equal))
         (jg-site--file-urls (make-hash-table :test #'equal))
         (jg-site--backlinks (make-hash-table :test #'equal))
         graph-links
         ;; Export settings for every page
         (org-export-with-toc nil)
         (org-export-with-section-numbers nil)
         (org-export-with-author nil)
         (org-export-with-smart-quotes t)
         (org-export-with-sub-superscripts '{})
         (org-export-with-broken-links 'mark)
         (org-export-use-babel nil)
         (org-html-htmlize-output-type nil))
    ;; Where every published page lives, so links between them work
    (dolist (piece writing)
      (puthash (file-truename (alist-get 'file piece)) (alist-get 'url piece) jg-site--file-urls))
    (dolist (note notes)
      (puthash (file-truename (alist-get 'file note)) (alist-get 'url note) jg-site--file-urls)
      (dolist (id (alist-get 'ids note))
        (puthash id (alist-get 'url note) jg-site--id-urls)))
    ;; Links between published pages (stories and notes alike): each page's
    ;; "Linked from" list. Links between two notes are also the graph's edges.
    (dolist (page (append writing notes))
      (let ((url (alist-get 'url page)))
        (dolist (target (jg-site--page-links (alist-get 'file page)))
          (unless (equal target url)
            (cl-pushnew (cons (alist-get 'title page) url)
                        (gethash target jg-site--backlinks)
                        :test #'equal)
            (when (and (string-prefix-p "/garden/" url) (string-prefix-p "/garden/" target))
              (cl-pushnew (cons url target) graph-links :test #'equal))))))
    ;; Pages
    (jg-site--clean "writing")
    (jg-site--clean "garden")
    ;; The exporter looks every id: link up in Org's ID database, scanning
    ;; files and rewriting it as it goes. `jg-site--link' resolves them itself,
    ;; so skip that and leave the database (and org-roam) alone.
    (cl-letf (((symbol-function 'org-id-find) #'ignore))
      (dolist (piece writing)
        (jg-site--export (alist-get 'file piece) (alist-get 'url piece) 'writing))
      (dolist (note notes)
        (jg-site--export (alist-get 'file note) (alist-get 'url note) 'garden)))
    ;; Indexes the site's JavaScript reads
    (jg-site--write-json
     "data/writing.json"
     (vconcat (mapcar (lambda (piece) (assq-delete-all 'file (copy-alist piece))) writing)))
    (jg-site--write-json
     "data/garden.json"
     `((nodes . ,(vconcat (mapcar (lambda (note)
                                    `((id . ,(alist-get 'url note))
                                      (title . ,(alist-get 'title note))
                                      (tags . ,(vconcat (alist-get 'tags note)))
                                      ;; When the note's file was last saved
                                      (modified . ,(format-time-string
                                                    "%Y-%m-%dT%H:%M:%S"
                                                    (file-attribute-modification-time
                                                     (file-attributes (alist-get 'file note)))))))
                                  notes)))
       (links . ,(vconcat (mapcar (lambda (link) `((source . ,(car link)) (target . ,(cdr link))))
                                  (nreverse graph-links))))))
    (message "Published %d piece%s of writing and %d garden note%s"
             (length writing) (if (= (length writing) 1) "" "s")
             (length notes) (if (= (length notes) 1) "" "s"))))

(when noninteractive
  (set-language-environment "UTF-8"))

(provide 'publish)
;;; publish.el ends here
