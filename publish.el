;;; publish.el --- Turn the site's Org files into web pages -*- lexical-binding: t; -*-

;; What this builds:
;;
;;   content/writing/*.org           ->  writing/*.html  + data/writing.json
;;   content/writing/*.fountain      ->  writing/*.html  (screenplays, see below)
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
;;
;; Images and attachments: a [[file:...]] link to an image shows it (with
;; #+caption: above it, as a captioned figure); a link to any other file that
;; isn't Org or Fountain (a PDF, a zip) is a download link. Either way the file
;; is copied to media/PAGE/ next to the page (writing/media/subway-music/...),
;; and media/ is cleared each publish like the pages.
;;
;; Sharing and search: each page gets Open Graph tags, which are what
;; Instagram, iMessage, Discord and the rest show when someone shares a link
;; (title, description, picture: the piece's first image, else og.png), and
;; each publish writes sitemap.xml, the list of pages search engines read
;; (robots.txt points them to it).

(require 'cl-lib)
(require 'ox-html)
(require 'json)
(require 'seq)
(require 'subr-x)
(require 'url-util)
(require 'url-expand)

(defvar jg-site-root
  (file-name-directory (or load-file-name buffer-file-name))
  "The website repository (the folder this file is in).")

(defvar jg-site-roam-directory (expand-file-name "~/org/roam/")
  "Where org-roam notes live. Only notes tagged `jg-site-publish-tag' go online.")

(defvar jg-site-url "https://jackgilmorecreative.com"
  "The live site's address, for links that leave it (previews, the sitemap).")

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
  "Every non-draft piece in content/writing/, as alists, newest first.
Org files and Fountain screenplays alike; a .fountain file is always a script."
  (let ((dir (expand-file-name "content/writing/" jg-site-root)) pieces)
    (dolist (file (and (file-directory-p dir)
                       (directory-files dir t "\\`[^.#].*\\.\\(org\\|fountain\\)\\'")))
      (let* ((fountain (jg-site--fountain-p file))
             (kw (if fountain (jg-site--fountain-keywords file) (jg-site--keywords file))))
        (unless (member (downcase (or (jg-site--kw kw "draft") "")) '("t" "yes" "true"))
          (push `((title . ,(or (jg-site--kw kw "title") (file-name-base file)))
                  (type . ,(if fountain "script" (downcase (or (jg-site--kw kw "type") "blog"))))
                  (publication . ,(or (jg-site--kw kw "publication") ""))
                  (date . ,(or (jg-site--date (or (jg-site--kw kw "date")
                                                  (jg-site--kw kw "draft date")))
                               ""))
                  (description . ,(or (jg-site--kw kw "description") ""))
                  (words . ,(if fountain
                                (jg-site--fountain-word-count file)
                              (jg-site--word-count file)))
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
  "Copy FILE (an image or attachment) to media/PAGE/ next to the page being
exported; return its relative URL. A folder per page, so two pieces can each
have a cover.jpg."
  (let* ((page (file-name-base (url-unhex-string (plist-get info :jg-url))))
         (dir (expand-file-name (concat "media/" page "/") (plist-get info :jg-out-dir))))
    (make-directory dir t)
    (copy-file file (expand-file-name (file-name-nondirectory file) dir) t)
    (concat "media/" (url-hexify-string page) "/"
            (url-hexify-string (file-name-nondirectory file)))))

(defun jg-site--attachment-p (file)
  "Non-nil if FILE can be published as a download: a file that isn't Org or
Fountain. Those are pages, published or private, never downloads."
  (and (file-regular-p file)
       (not (string-match-p "\\.\\(org\\|fountain\\)\\'" file))))

(defun jg-site--image-alt (link info)
  "Alt text for the image LINK: its #+attr_html: :alt, or else its caption."
  (let* ((paragraph (org-export-get-parent-element link))
         (alt (plist-get (org-export-read-attribute :attr_html paragraph) :alt))
         (caption (org-export-get-caption paragraph)))
    (if alt
        (jg-site--escape alt)
      ;; The caption is already HTML (entities and all): drop its tags, and
      ;; quote marks would end the attribute
      (thread-last (if caption (org-export-data caption info) "")
                   (replace-regexp-in-string "<[^>]+>" "")
                   (replace-regexp-in-string "\"" "&quot;")))))

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
                    (format "<img src=\"%s\" alt=\"%s\">" src (jg-site--image-alt link info)))))
               (page (format "<a href=\"%s\">%s</a>" page (or desc page)))
               ;; Any other file (a PDF, say): a download link
               ((jg-site--attachment-p file)
                (format "<a href=\"%s\" download>%s</a>" (jg-site--copy-media file info)
                        (or desc (jg-site--escape (file-name-nondirectory file)))))
               (t (or desc "")))))
      (_ (org-html-link link desc info)))))

(defun jg-site--template (contents info)
  "Wrap the exported CONTENTS in the site's page layout."
  (let* ((input (plist-get info :input-file))
         (kw (and input (jg-site--keywords input))))
    (jg-site--page
     :kind (plist-get info :jg-kind)
     :title (org-export-data (plist-get info :title) info)
     :type (plist-get info :jg-type)
     :publication (plist-get info :jg-publication)
     :date (jg-site--kw kw "date")
     :description (plist-get info :description)
     :url (plist-get info :jg-url)
     :contents contents)))

(defconst jg-site--entities
  '(("amp" . "&") ("lt" . "<") ("gt" . ">") ("quot" . "\"") ("nbsp" . " ")
    ("rsquo" . "’") ("lsquo" . "‘") ("rdquo" . "”") ("ldquo" . "“")
    ("hellip" . "…") ("mdash" . "—") ("ndash" . "–"))
  "The named HTML entities Org's export writes, as the characters they are.")

(defun jg-site--unescape (html)
  "HTML's entities (&rsquo;, &#x2026;) as the characters they stand for."
  (replace-regexp-in-string
   "&\\(#x[0-9a-fA-F]+\\|#[0-9]+\\|[a-z]+\\);"
   (lambda (match)
     (let ((name (substring match 1 -1)))
       (cond ((string-prefix-p "#x" name) (string (string-to-number (substring name 2) 16)))
             ((string-prefix-p "#" name) (string (string-to-number (substring name 1))))
             (t (or (cdr (assoc name jg-site--entities)) match)))))
   html t t))

(defun jg-site--summary (contents)
  "The start of CONTENTS (HTML) as plain text: its first paragraph, cut to
about 200 characters. For pages without a #+description:."
  (if (not (string-match "<p>\\(\\(?:.\\|\n\\)*?\\)</p>" (or contents "")))
      ""
    (let ((text (string-trim (replace-regexp-in-string
                              "[ \t\n]+" " "
                              (jg-site--unescape
                               (replace-regexp-in-string "<[^>]+>" "" (match-string 1 contents)))))))
      (if (<= (length text) 200)
          text
        (concat (replace-regexp-in-string " +[^ ]*\\'" "" (substring text 0 200)) "…")))))

(defun jg-site--share-image (contents url)
  "The picture a shared link to the page at URL shows: the first image in its
CONTENTS, as a full address, or the site's card (og.png)."
  (if (string-match "<img src=\"\\([^\"]+\\)\"" (or contents ""))
      (url-expand-file-name (match-string 1 contents) (concat jg-site-url url))
    (concat jg-site-url "/og.png")))

(defun jg-site--share-tags (title description image url)
  "Open Graph tags (and Twitter's) for a page: what a shared link shows.
TITLE and DESCRIPTION are already escaped."
  (concat
   "<meta property=\"og:site_name\" content=\"Jack Gilmore\">\n"
   "<meta property=\"og:type\" content=\"article\">\n"
   (format "<meta property=\"og:title\" content=\"%s\">\n" title)
   (if (string-empty-p description) ""
     (format "<meta property=\"og:description\" content=\"%s\">\n" description))
   (format "<meta property=\"og:image\" content=\"%s\">\n" image)
   (format "<meta property=\"og:url\" content=\"%s%s\">\n" jg-site-url url)
   "<meta name=\"twitter:card\" content=\"summary_large_image\">\n"
   (format "<link rel=\"canonical\" href=\"%s%s\">\n" jg-site-url url)))

(cl-defun jg-site--page (&key kind title type publication date description url
                              contents (article-class "prose") head)
  "A whole page in the site's layout, for a KIND page (writing or garden).
TITLE and CONTENTS are HTML. ARTICLE-CLASS is the class of the <article>
around CONTENTS, and HEAD is extra HTML for the <head>."
  (let* ((type (downcase (or type "blog")))
         (eyebrow (if (eq kind 'garden)
                      "Garden note"
                    (or (cdr (assoc type jg-site-type-labels)) (capitalize type))))
         (byline (string-join
                  (seq-remove #'string-empty-p
                              (delq nil (list (jg-site--escape publication)
                                  (jg-site--pretty-date (jg-site--date date)))))
                  " · "))
         ;; No #+description:? The opening lines say what it is, for Google
         ;; and link previews alike
         (description (jg-site--escape (if (string-empty-p (or description ""))
                                           (jg-site--summary contents)
                                         description)))
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
     (jg-site--share-tags (jg-site--escape title) description
                          (jg-site--share-image contents url) url)
     "<link rel=\"icon\" href=\"/favicon.ico\" sizes=\"32x32\">
<link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\">
<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">
<script src=\"/theme.js\"></script>
<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
<link href=\"https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400..700;1,400..700&display=swap\" rel=\"stylesheet\">
<link rel=\"stylesheet\" href=\"/site.css\">
<script src=\"/nav.js\" defer></script>
<script src=\"/analytics.js\" defer></script>
" (or head "") "</head>
<body>
<main class=\"page page-narrow\">
"    ;; Breadcrumbs: Garden / this note, or Read / Blog (or Writing) / this piece
     "<nav class=\"crumbs\" aria-label=\"Breadcrumb\">"
     (cond ((eq kind 'garden) "<a href=\"/garden.html\">Garden</a>")
           ((equal type "blog") "<a href=\"/read.html\">Read</a><a href=\"/read.html#blog\">Blog</a>")
           (t "<a href=\"/read.html\">Read</a><a href=\"/read.html#writing\">Writing</a>"))
     "<span aria-current=\"page\">" title "</span></nav>\n"
     "<article class=\"" article-class "\">
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
  "Export Org FILE as the page at site URL, a KIND page (writing or garden).
A Fountain screenplay goes to `jg-site--export-fountain' instead."
  (if (jg-site--fountain-p file)
      (jg-site--export-fountain file url)
    (jg-site--export-org file url kind)))

(defun jg-site--export-org (file url kind)
  "Export Org FILE as the page at site URL, a KIND page (writing or garden)."
  (let* ((org-inhibit-startup t)
         (out-file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
         (out-dir (file-name-directory out-file))
         (visiting (find-buffer-visiting file))
         (buffer (or visiting (let ((coding-system-for-read 'utf-8))
                                (find-file-noselect file)))))
    (unwind-protect
        (with-current-buffer buffer
          ;; html5-fancy: a captioned image is a <figure> with a <figcaption>
          (org-export-to-file 'jg-site out-file
            nil nil nil nil (list :jg-kind kind :jg-out-dir out-dir :jg-url url
                                  :html-doctype "html5" :html-html5-fancy t)))
      (unless visiting (kill-buffer buffer)))))


;;; Fountain screenplays
;;
;; A .fountain file in content/writing/ is a screenplay in Fountain
;; (https://fountain.io), the plain-text format screenwriting apps read. Its
;; title page holds what the site needs, the same things an Org piece keeps
;; in #+ keywords:
;;
;;   Title: The Giant
;;   Credit: Written by
;;   Author: Jack Gilmore
;;   Draft date: 2026-10-25
;;   Description: One line for the Read page.
;;   Draft: t
;;
;; (Description and Draft aren't standard Fountain, but every app ignores keys
;; it doesn't know.) The script itself becomes HTML with one class per element
;; (scene-heading, action, character, dialogue...), which site.css lays out
;; like a printed screenplay.

(defun jg-site--fountain-p (file)
  "Non-nil if FILE is a Fountain screenplay."
  (string-suffix-p ".fountain" file t))

(defun jg-site--fountain-read (file)
  "FILE's text as (KEYWORDS . BODY): its title page as an alist with downcased
keys, and the script after it, with boneyard /* */ and [[notes]] removed."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (goto-char (point-min))
    (while (re-search-forward "\r\n?" nil t) (replace-match "\n"))
    (let ((text (replace-regexp-in-string
                 "\\[\\[\\(?:.\\|\n\\)*?\\]\\]" ""
                 (replace-regexp-in-string "/\\*\\(?:.\\|\n\\)*?\\*/" "" (buffer-string))))
          keywords)
      ;; A title page is "Key: value" lines at the very top, ending at the
      ;; first blank line. Indented lines continue the key above them.
      (when (string-match "\\`[ \t]*[A-Za-z][A-Za-z ]*:" text)
        (let* ((end (or (string-match "\n[ \t]*\n" text) (length text)))
               (lines (split-string (substring text 0 end) "\n")))
          (setq text (substring text (min (length text) (1+ end))))
          (dolist (line lines)
            (if (string-match "\\`\\([A-Za-z][A-Za-z ]*\\):[ \t]*\\(.*?\\)[ \t]*\\'" line)
                (push (cons (downcase (match-string 1 line)) (match-string 2 line)) keywords)
              (when keywords
                (setcdr (car keywords)
                        (string-trim (concat (cdar keywords) " " (string-trim line)))))))))
      (cons (nreverse keywords) text))))

(defun jg-site--fountain-keywords (file)
  "FILE's title page, as an alist with downcased keys (like `jg-site--keywords').
The title loses Fountain's emphasis marks (_**TITLE**_ is common)."
  (mapcar (lambda (kv)
            (if (equal (car kv) "title")
                (cons "title" (replace-regexp-in-string "[*_]" "" (cdr kv)))
              kv))
          (car (jg-site--fountain-read file))))

(defun jg-site--fountain-word-count (file)
  "Words in FILE's script, not counting its title page or notes."
  (with-temp-buffer
    (insert (cdr (jg-site--fountain-read file)))
    (count-words (point-min) (point-max))))

(defun jg-site--fountain-inline (text)
  "TEXT escaped for HTML, with Fountain's *italic*, **bold**, ***both*** and
_underline_. A backslash keeps a * or _ as it is."
  (let ((s (thread-last (or text "")
                        (replace-regexp-in-string "\\\\\\*" "\1")
                        (replace-regexp-in-string "\\\\_" "\2")
                        (replace-regexp-in-string "&" "&amp;")
                        (replace-regexp-in-string "<" "&lt;")
                        (replace-regexp-in-string ">" "&gt;"))))
    (dolist (rule '(("\\*\\*\\*\\(.+?\\)\\*\\*\\*" . "<strong><em>\\1</em></strong>")
                    ("\\*\\*\\(.+?\\)\\*\\*" . "<strong>\\1</strong>")
                    ("\\*\\(.+?\\)\\*" . "<em>\\1</em>")
                    ("_\\(.+?\\)_" . "<u>\\1</u>")))
      (setq s (replace-regexp-in-string (car rule) (cdr rule) s t)))
    (thread-last s
                 (replace-regexp-in-string "\1" "*")
                 (replace-regexp-in-string "\2" "_"))))

(defconst jg-site--fountain-scene-re
  "\\`\\(?:INT\\|EXT\\|EST\\|INT\\.?/EXT\\|I/E\\)[. ]"
  "How an unforced scene heading starts (any case).")

(defun jg-site--fountain-character-p (line)
  "Non-nil if LINE looks like a character cue: a name in capitals, maybe with
an extension like (V.O.) and a ^ for dual dialogue."
  (let ((name (string-trim (replace-regexp-in-string "\\(([^)]*)\\|\\^\\)" "" line)))
        (case-fold-search nil))
    (and (string-match-p "[A-Z]" name)
         (not (string-match-p "[a-z]" name)))))

(defun jg-site--fountain-html (text)
  "The screenplay TEXT (a script's body, after its title page) as HTML."
  (let* ((lines (vconcat (split-string text "\n")))
         (n (length lines))
         (blank (lambda (j) (or (< j 0) (>= j n) (string-blank-p (aref lines j)))))
         (i 0) out last-dialogue)
    (cl-flet ((emit (class content &optional tag)
                (push (format "<%s class=\"%s\">%s</%s>" (or tag "p") class content (or tag "p"))
                      out)
                (setq last-dialogue nil)))
      (while (< i n)
        (let* ((raw (aref lines i))
               (line (string-trim raw)))
          (cond
           ((string-empty-p line) (setq i (1+ i)))
           ;; === is a page break. # sections and = synopses are notes for
           ;; the writer, which a screenplay doesn't print.
           ((string-match-p "\\`===+\\'" line)
            (push "<hr class=\"page-break\">" out)
            (setq i (1+ i) last-dialogue nil))
           ((string-match-p "\\`[#=]" line) (setq i (1+ i)))
           ;; Scene heading: forced with a leading ., or INT./EXT. etc. on its
           ;; own line. A trailing #12# is its scene number.
           ((or (and (string-match-p "\\`\\.[^.]" line))
                (and (let ((case-fold-search t))
                       (string-match-p jg-site--fountain-scene-re line))
                     (funcall blank (1- i)) (funcall blank (1+ i))))
            (let* ((heading (if (string-prefix-p "." line) (substring line 1) line))
                   (number (and (string-match "[ \t]*#\\([^#]+\\)#\\'" heading)
                                (prog1 (match-string 1 heading)
                                  (setq heading (substring heading 0 (match-beginning 0)))))))
              (emit "scene-heading"
                    (concat (jg-site--fountain-inline (upcase heading))
                            (if number (format "<span class=\"scene-number\">%s</span>"
                                               (jg-site--fountain-inline number))
                              "")))
              (setq i (1+ i))))
           ;; > CENTERED <
           ((string-match "\\`>[ \t]*\\(.*?\\)[ \t]*<\\'" line)
            (emit "centered" (jg-site--fountain-inline (match-string 1 line)))
            (setq i (1+ i)))
           ;; Transition: forced with >, or capitals ending in TO: on their own
           ((or (string-prefix-p ">" line)
                (and (let ((case-fold-search nil))
                       (string-match-p "\\`[^a-z]*TO:\\'" line))
                     (funcall blank (1- i)) (funcall blank (1+ i))))
            (emit "transition"
                  (jg-site--fountain-inline (string-trim (string-remove-prefix ">" line))))
            (setq i (1+ i)))
           ;; ~ lyrics
           ((string-prefix-p "~" line)
            (emit "lyrics" (jg-site--fountain-inline (string-trim (substring line 1))))
            (setq i (1+ i)))
           ;; Character cue (forced with @), then its dialogue until a blank line
           ((and (not (string-prefix-p "!" line))
                 (funcall blank (1- i))
                 (not (funcall blank (1+ i)))
                 (or (string-prefix-p "@" line) (jg-site--fountain-character-p line)))
            (let* ((dual (string-suffix-p "^" line))
                   (name (string-trim (string-remove-suffix
                                       "^" (string-remove-prefix "@" line))))
                   (parts (list (format "<p class=\"character\">%s</p>"
                                        (jg-site--fountain-inline name)))))
              (setq i (1+ i))
              (while (and (< i n) (not (funcall blank i)))
                (let ((l (string-trim (aref lines i))))
                  (push (cond ((string-match-p "\\`(.*)\\'" l)
                               (format "<p class=\"parenthetical\">%s</p>"
                                       (jg-site--fountain-inline l)))
                              ((string-prefix-p "~" l)
                               (format "<p class=\"lyrics\">%s</p>"
                                       (jg-site--fountain-inline (string-trim (substring l 1)))))
                              (t (format "<p class=\"dialogue\">%s</p>"
                                         (jg-site--fountain-inline l))))
                        parts))
                (setq i (1+ i)))
              (let ((block (concat "<div class=\"speech\">"
                                   (apply #'concat (nreverse parts)) "</div>")))
                ;; NAME ^ speaks at the same time as the speech just before
                (if (and dual last-dialogue)
                    (setcar out (concat "<div class=\"dual-dialogue\">"
                                        (car out) block "</div>"))
                  (push block out))
                (setq last-dialogue (not dual)))))
           ;; Anything else is action, up to the next blank line. Its line
           ;; breaks and indentation stay as written (site.css: pre-wrap).
           (t
            (let (para)
              (while (and (< i n) (not (funcall blank i)))
                (push (jg-site--fountain-inline
                       (let ((l (string-trim-right (aref lines i))))
                         (if (string-prefix-p "!" (string-trim-left l))
                             (replace-regexp-in-string "\\`\\([ \t]*\\)!" "\\1" l)
                           l)))
                      para)
                (setq i (1+ i)))
              (emit "action" (string-join (nreverse para) "\n"))))))))
    (string-join (nreverse out) "\n")))

(defun jg-site--export-fountain (file url)
  "Export the Fountain screenplay FILE as the writing page at site URL."
  (let* ((script (jg-site--fountain-read file))
         (kw (mapcar (lambda (kv)
                       (if (equal (car kv) "title")
                           (cons "title" (replace-regexp-in-string "[*_]" "" (cdr kv)))
                         kv))
                     (car script)))
         (out-file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
         (coding-system-for-write 'utf-8))
    (make-directory (file-name-directory out-file) t)
    (with-temp-file out-file
      (insert
       (jg-site--page
        :kind 'writing
        :title (jg-site--escape (or (jg-site--kw kw "title") (file-name-base file)))
        :type "script"
        :publication (jg-site--kw kw "publication")
        :date (or (jg-site--kw kw "date") (jg-site--kw kw "draft date"))
        :description (jg-site--kw kw "description")
        :url url
        :article-class "screenplay"
        :head "<link href=\"https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap\" rel=\"stylesheet\">\n"
        :contents (jg-site--fountain-html (cdr script)))))))

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

(defconst jg-site--sitemap-pages
  '("/" "/animation.html" "/read.html" "/garden.html" "/everything.html" "/reel.html")
  "The hand-written pages, for the sitemap (not the old ones that redirect).")

(defun jg-site--series-slugs (file)
  "The addresses' names (slugs) of the series in FILE (relative to content/):
top-level headings with :KIND: series, not COMMENTed, slugged like catalog.js."
  (let ((path (expand-file-name file (expand-file-name "content/" jg-site-root))))
    (when (file-exists-p path)
      (with-temp-buffer
        (let ((coding-system-for-read 'utf-8))
          (insert-file-contents path))
        (let ((org-inhibit-startup t)) (delay-mode-hooks (org-mode)))
        (let (slugs)
          (org-map-entries
           (lambda ()
             (when (and (= (org-current-level) 1)
                        (not (org-in-commented-heading-p))
                        (equal (downcase (or (org-entry-get nil "KIND") "")) "series"))
               (push (jg-site--slug (org-get-heading t t t t)) slugs))))
          (nreverse slugs))))))

(defun jg-site--write-sitemap (writing notes)
  "Write sitemap.xml: the hand-written pages, each series, and every piece
of WRITING and garden note in NOTES (with when it last changed)."
  (let ((entry (lambda (url &optional lastmod)
                 (format "  <url><loc>%s%s</loc>%s</url>\n"
                         jg-site-url (replace-regexp-in-string "&" "&amp;" url)
                         (if (and lastmod (not (string-empty-p lastmod)))
                             (format "<lastmod>%s</lastmod>" lastmod)
                           ""))))
        (coding-system-for-write 'utf-8))
    (with-temp-file (expand-file-name "sitemap.xml" jg-site-root)
      (insert "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
              "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n")
      (dolist (url jg-site--sitemap-pages)
        (insert (funcall entry url)))
      (dolist (slug (jg-site--series-slugs "animation.org"))
        (insert (funcall entry (concat "/series.html?s=" slug))))
      (dolist (slug (jg-site--series-slugs "comics.org"))
        (insert (funcall entry (concat "/comic-series.html?s=" slug))))
      (dolist (piece writing)
        (insert (funcall entry (alist-get 'url piece) (alist-get 'date piece))))
      (dolist (note notes)
        (insert (funcall entry (alist-get 'url note)
                         (format-time-string "%Y-%m-%d" (file-attribute-modification-time
                                                         (file-attributes (alist-get 'file note)))))))
      (insert "</urlset>\n"))))

(defun jg-site--clean (dir)
  "Delete the generated .html pages in DIR (relative to the site root), and
the images and attachments copied for them (DIR/media/)."
  (let ((path (expand-file-name dir jg-site-root)))
    (make-directory path t)
    (dolist (file (directory-files path t "\\.html\\'"))
      (delete-file file))
    (when (file-directory-p (expand-file-name "media" path))
      (delete-directory (expand-file-name "media" path) t))))

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
    (jg-site--write-sitemap writing notes)
    (message "Published %d piece%s of writing and %d garden note%s"
             (length writing) (if (= (length writing) 1) "" "s")
             (length notes) (if (= (length notes) 1) "" "s"))))

(when noninteractive
  (set-language-environment "UTF-8"))

(provide 'publish)
;;; publish.el ends here
