;;; publish.el --- Turn the site's Org files into web pages -*- lexical-binding: t; -*-

;; What this builds:
;;
;;   content/writing/*.org           ->  writing/*.html  + data/writing.json
;;   content/writing/*.fountain      ->  writing/*.html  (screenplays, see below)
;;   content/writing/*.org, a book   ->  writing/*.html, writing/*/chapter-N.html
;;                                       and writing/*.epub (see "Books")
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
;; (robots.txt points them to it), and feed.xml, the blog's RSS feed.
;;
;; Dates: a piece's date is the day it went online (see "Publication dates").

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
    ("article" . "Article") ("script" . "Script") ("blog" . "Blog post")
    ("book" . "Book"))
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
                  ;; A script's draft and its date, for the title page on its
                  ;; card (Read page)
                  ,@(when fountain
                      `((revision . ,(or (jg-site--kw kw "revision") "First Draft"))
                        (draft . ,(or (jg-site--date (or (jg-site--kw kw "draft date")
                                                         (jg-site--kw kw "date")))
                                      ""))))
                  ,@(when (and (not fountain) (jg-site--book-p kw))
                      (let ((cover (jg-site--book-cover file kw)))
                        `((cover . ,(and cover (jg-site--book-cover-url file cover)))
                          (epub . ,(format "/writing/%s.epub" (url-hexify-string (file-name-base file))))
                          (chapters . ,(vconcat (jg-site--book-chapters file))))))
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

(defconst jg-site--share-button
  "<button class=\"share-button\" type=\"button\" data-share aria-label=\"Share\" title=\"Share\"></button>"
  "A page's Share button. nav.js adds its icon and makes it work: the share
sheet on a phone, copying the page's link on a computer.")

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
                              contents (article-class "prose") head
                              crumbs eyebrow byline header after actions)
  "A whole page in the site's layout, for a KIND page (writing or garden).
TITLE and CONTENTS are HTML. ARTICLE-CLASS is the class of the <article>
around CONTENTS, and HEAD is extra HTML for the <head>. Pages that aren't
an ordinary piece (a book, its chapters) can give their own CRUMBS (the
breadcrumb links before the page's own name), EYEBROW and BYLINE (HTML),
whole HEADER (HTML, or \"\" for none), and HTML to put AFTER the article.
Under the byline is a Share button (nav.js makes it work), then ACTIONS
(more buttons, HTML: a script's Download PDF)."
  (let* ((type (downcase (or type "blog")))
         (eyebrow (or eyebrow
                      (if (eq kind 'garden)
                          "Garden note"
                        (or (cdr (assoc type jg-site-type-labels)) (capitalize type)))))
         (byline (or byline
                     (string-join
                      (seq-remove #'string-empty-p
                                  (delq nil (list (jg-site--escape publication)
                                                  (jg-site--pretty-date (jg-site--date date)))))
                      " · ")))
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
<link rel=\"alternate\" type=\"application/rss+xml\" title=\"Jack Gilmore — Blog\" href=\"/feed.xml\">
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
     (cond (crumbs crumbs)
           ((eq kind 'garden) "<a href=\"/garden.html\">Garden</a>")
           ((equal type "blog") "<a href=\"/read.html\">Read</a><a href=\"/read.html#blog\">Blog</a>")
           (t "<a href=\"/read.html\">Read</a><a href=\"/read.html#writing\">Writing</a>"))
     "<span aria-current=\"page\">" title "</span></nav>\n"
     "<article class=\"" article-class "\">\n"
     (or header
         (concat "<header class=\"prose-head\">
<p class=\"eyebrow\">" eyebrow "</p>
<h1>" title "</h1>
"                (if (string-empty-p byline) "" (format "<p class=\"byline\">%s</p>\n" byline))
                 "<div class=\"prose-actions\">" jg-site--share-button (or actions "") "</div>\n"
                 "</header>\n"))
     contents "
</article>
"    (or after "")
     (if (not backlinks) ""
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
  (cond ((jg-site--fountain-p file) (jg-site--export-fountain file url))
        ((and (eq kind 'writing) (jg-site--book-p (jg-site--keywords file)))
         (jg-site--export-book file url))
        (t (jg-site--export-org file url kind))))

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
;;   Revision: Second Draft
;;   Description: One line for the Read page.
;;   Draft: t
;;
;; Revision names the draft (First Draft, Revised Draft, Shooting Script...)
;; on its card's title page on the Read page; without it, it says First
;; Draft. Draft: t keeps the script off the site, like #+draft: in Org.
;; (Description, Revision and Draft aren't standard Fountain, but every app ignores keys
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

(defun jg-site--fountain-parse (text)
  "The screenplay TEXT (a script's body, after its title page), as a list of
its elements, in order. Each is a list starting with its kind:
  (scene-heading HEADING NUMBER)   NUMBER is a #12# scene number, or nil
  (action LINES)                   its lines, as written
  (speech PARTS)                   PARTS: (character . NAME) then any of
                                   (parenthetical . TEXT), (dialogue . TEXT),
                                   (lyrics . TEXT)
  (dual PARTS PARTS)               two speeches at once (NAME ^)
  (centered TEXT) (transition TEXT) (lyrics TEXT) (page-break)
Texts are as written, with Fountain's *emphasis* marks still in."
  (let* ((lines (vconcat (split-string text "\n")))
         (n (length lines))
         (blank (lambda (j) (or (< j 0) (>= j n) (string-blank-p (aref lines j)))))
         (i 0) out)
    (while (< i n)
      (let* ((raw (aref lines i))
             (line (string-trim raw)))
        (cond
         ((string-empty-p line) (setq i (1+ i)))
         ;; === is a page break. # sections and = synopses are notes for
         ;; the writer, which a screenplay doesn't print.
         ((string-match-p "\\`===+\\'" line)
          (push '(page-break) out)
          (setq i (1+ i)))
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
            (push (list 'scene-heading heading number) out)
            (setq i (1+ i))))
         ;; > CENTERED <
         ((string-match "\\`>[ \t]*\\(.*?\\)[ \t]*<\\'" line)
          (push (list 'centered (match-string 1 line)) out)
          (setq i (1+ i)))
         ;; Transition: forced with >, or capitals ending in TO: on their own
         ((or (string-prefix-p ">" line)
              (and (let ((case-fold-search nil))
                     (string-match-p "\\`[^a-z]*TO:\\'" line))
                   (funcall blank (1- i)) (funcall blank (1+ i))))
          (push (list 'transition (string-trim (string-remove-prefix ">" line))) out)
          (setq i (1+ i)))
         ;; ~ lyrics
         ((string-prefix-p "~" line)
          (push (list 'lyrics (string-trim (substring line 1))) out)
          (setq i (1+ i)))
         ;; Character cue (forced with @), then its dialogue until a blank line
         ((and (not (string-prefix-p "!" line))
               (funcall blank (1- i))
               (not (funcall blank (1+ i)))
               (or (string-prefix-p "@" line) (jg-site--fountain-character-p line)))
          (let* ((dual (string-suffix-p "^" line))
                 (parts (list (cons 'character
                                    (string-trim (string-remove-suffix
                                                  "^" (string-remove-prefix "@" line)))))))
            (setq i (1+ i))
            (while (and (< i n) (not (funcall blank i)))
              (let ((l (string-trim (aref lines i))))
                (push (cond ((string-match-p "\\`(.*)\\'" l) (cons 'parenthetical l))
                            ((string-prefix-p "~" l) (cons 'lyrics (string-trim (substring l 1))))
                            (t (cons 'dialogue l)))
                      parts))
              (setq i (1+ i)))
            (setq parts (nreverse parts))
            ;; NAME ^ speaks at the same time as the speech just before
            (if (and dual (eq (car-safe (car out)) 'speech))
                (setcar out (list 'dual (cadr (car out)) parts))
              (push (list 'speech parts) out))))
         ;; Anything else is action, up to the next blank line. Its line
         ;; breaks and indentation stay as written.
         (t
          (let (para)
            (while (and (< i n) (not (funcall blank i)))
              (push (let ((l (string-trim-right (aref lines i))))
                      (if (string-prefix-p "!" (string-trim-left l))
                          (replace-regexp-in-string "\\`\\([ \t]*\\)!" "\\1" l)
                        l))
                    para)
              (setq i (1+ i)))
            (push (list 'action (nreverse para)) out))))))
    (nreverse out)))

(defun jg-site--fountain-html (text)
  "The screenplay TEXT (a script's body, after its title page) as HTML: one
class per element, which site.css lays out like a printed screenplay (action
keeps its line breaks and indentation: pre-wrap)."
  (let ((p (lambda (class text)
             (format "<p class=\"%s\">%s</p>" class (jg-site--fountain-inline text))))
        (speech (lambda (parts)
                  (concat "<div class=\"speech\">"
                          (mapconcat (lambda (part)
                                       (format "<p class=\"%s\">%s</p>" (car part)
                                               (jg-site--fountain-inline (cdr part))))
                                     parts "")
                          "</div>"))))
    (mapconcat
     (lambda (element)
       (pcase element
         (`(page-break) "<hr class=\"page-break\">")
         (`(scene-heading ,heading ,number)
          (format "<p class=\"scene-heading\">%s%s</p>"
                  (jg-site--fountain-inline (upcase heading))
                  (if number (format "<span class=\"scene-number\">%s</span>"
                                     (jg-site--fountain-inline number))
                    "")))
         (`(action ,lines)
          (format "<p class=\"action\">%s</p>"
                  (mapconcat #'jg-site--fountain-inline lines "\n")))
         (`(speech ,parts) (funcall speech parts))
         (`(dual ,left ,right)
          (concat "<div class=\"dual-dialogue\">" (funcall speech left) (funcall speech right) "</div>"))
         (`(,class ,text) (funcall p (symbol-name class) text))))
     (jg-site--fountain-parse text) "\n")))

;;; Screenplay PDFs
;;
;; Each script is also a PDF in the standard screenplay format, for reading
;; and printing: writing/NAME.pdf, its page's Download PDF. US Letter, 12-point
;; Courier (10 characters an inch, 6 lines an inch), 1.5" on the left and 1"
;; elsewhere, characters at 3.7", dialogue at 2.5", page numbers top right, and
;; a title page from the title page's Title, Credit, Author, Source, Contact
;; and Draft date.
;;
;; It's written here directly: a PDF is mostly text (where each word goes on
;; which page), and Courier is one of the fonts every PDF reader has built
;; in, so nothing is needed but Emacs. Characters outside Latin-1 that the
;; built-in fonts don't have (other than curly quotes, dashes and the
;; ellipsis, which they do) print as ?.

(defconst jg-site--pdf-char 7.2 "The width of a character of 12-point Courier, in points.")

(defconst jg-site--pdf-page-lines 54 "Lines on a page: 9\" at 6 lines an inch.")

(defun jg-site--fountain-chars (text &optional style)
  "TEXT as a vector of (CHAR . STYLE), STYLE being (BOLD ITALIC UNDERLINE)
from Fountain's ***bold italic***, **bold**, *italic* and _underline_
(a mark with no partner later on is just itself; a backslash keeps one).
STYLE (a list like that) is added to every character."
  (let* ((n (length text)) (i 0)
         (bold (nth 0 style)) (italic (nth 1 style)) (under (nth 2 style))
         (base-bold bold) (base-italic italic)
         out)
    (cl-flet ((put (string) (dolist (c (string-to-list string))
                              (push (cons (if (eq c ?\t) ?\s c) (list bold italic under)) out)))
              (later (mark) (string-search mark text (+ i (length mark)))))
      (while (< i n)
        (let* ((c (aref text i))
               (rest (substring text i))
               (mark (cond ((string-prefix-p "***" rest) "***")
                           ((string-prefix-p "**" rest) "**")
                           ((eq c ?*) "*")
                           ((eq c ?_) "_"))))
          (cond
           ((and (eq c ?\\) (< (1+ i) n) (memq (aref text (1+ i)) '(?* ?_)))
            (put (string (aref text (1+ i))))
            (setq i (+ i 2)))
           ((not mark) (put (string c)) (setq i (1+ i)))
           (t
            (pcase mark
              ("***" (cond ((and bold italic (not base-bold)) (setq bold nil italic nil))
                           ((later mark) (setq bold t italic t))
                           (t (put mark))))
              ("**" (cond ((and bold (not base-bold)) (setq bold nil))
                          ((later mark) (setq bold t))
                          (t (put mark))))
              ("*" (cond ((and italic (not base-italic)) (setq italic nil))
                         ((later mark) (setq italic t))
                         (t (put mark))))
              ("_" (cond (under (setq under nil))
                         ((later mark) (setq under t))
                         (t (put mark)))))
            (setq i (+ i (length mark))))))))
    (vconcat (nreverse out))))

(defun jg-site--pdf-wrap (chars width)
  "CHARS (a vector from `jg-site--fountain-chars') broken at spaces into lines
of at most WIDTH characters: a list of vectors."
  (let ((n (length chars)) (pos 0) lines)
    (while (> (- n pos) width)
      (let ((brk (cl-loop for j downfrom (+ pos width) above pos
                          when (eq (car (aref chars j)) ?\s) return j)))
        (if brk
            (progn (push (substring chars pos brk) lines)
                   (setq pos (1+ brk)))
          (push (substring chars pos (+ pos width)) lines)
          (setq pos (+ pos width)))))
    (push (substring chars pos) lines)
    (nreverse lines)))

(defun jg-site--pdf-lines (text x width &optional style align)
  "TEXT set at X points from the left in lines of WIDTH characters, with
STYLE (see `jg-site--fountain-chars'). ALIGN `right' ends lines at X, `center'
centers them on X. A list of lines, each a list of (X . CHARS)."
  (mapcar (lambda (line)
            (let ((w (* (length line) jg-site--pdf-char)))
              (list (cons (pcase align
                            ('right (- x w))
                            ('center (- x (/ w 2)))
                            (_ x))
                          line))))
          (jg-site--pdf-wrap (jg-site--fountain-chars text style) width)))

(defun jg-site--pdf-speech (parts base &optional narrow)
  "A speech's PARTS as lines, its dialogue starting BASE points from the left.
NARROW is for one side of dual dialogue."
  (apply #'append
         (mapcar (lambda (part)
                   (pcase (car part)
                     ('character (jg-site--pdf-lines (cdr part) (+ base (if narrow 64.8 86.4))
                                                     (if narrow 20 38)))
                     ('parenthetical (jg-site--pdf-lines (cdr part) (+ base (if narrow 21.6 43.2))
                                                         (if narrow 22 25)))
                     ('lyrics (jg-site--pdf-lines (cdr part) base (if narrow 28 35) '(nil t nil)))
                     (_ (jg-site--pdf-lines (cdr part) base (if narrow 28 35)))))
                 parts)))

(defun jg-site--pdf-blocks (elements)
  "The screenplay ELEMENTS (from `jg-site--fountain-parse') as (KIND LINES),
LINES as `jg-site--pdf-lines' makes them; a page break is (page-break)."
  (mapcar
   (lambda (element)
     (pcase element
       (`(page-break) '(page-break nil))
       (`(scene-heading ,heading ,number)
        (list 'scene-heading
              (let ((lines (jg-site--pdf-lines (upcase heading) 108 60 '(t nil nil))))
                (if (not number) lines
                  ;; The scene number on both sides, in the margins
                  (cons (append (car lines)
                                (list (cons (- 108 (* (+ 3 (length number)) jg-site--pdf-char))
                                            (jg-site--fountain-chars number))
                                      (cons 540 (jg-site--fountain-chars number))))
                        (cdr lines))))))
       (`(action ,lines)
        (list 'action (apply #'append (mapcar (lambda (l) (jg-site--pdf-lines l 108 60)) lines))))
       (`(speech ,parts) (list 'speech (jg-site--pdf-speech parts 180)))
       (`(dual ,left ,right)
        (let ((l (jg-site--pdf-speech left 108 t))
              (r (jg-site--pdf-speech right 324 t)))
          (list 'speech (cl-loop for i below (max (length l) (length r))
                                 collect (append (nth i l) (nth i r))))))
       (`(transition ,text) (list 'transition (jg-site--pdf-lines (upcase text) 540 60 nil 'right)))
       (`(centered ,text) (list 'centered (jg-site--pdf-lines text 324 60 nil 'center)))
       (`(lyrics ,text) (list 'lyrics (jg-site--pdf-lines text 180 35 '(nil t nil))))))
   elements))

(defun jg-site--pdf-paginate (blocks)
  "BLOCKS (from `jg-site--pdf-blocks') laid out on pages: a list of pages,
each a list of lines (nil for a blank one). A blank line goes between blocks.
A scene heading stays with the start of what follows it; a speech that
doesn't fit goes on the next page whole, unless it's too long for any page;
action is split where the page ends."
  (let ((max jg-site--pdf-page-lines) pages page (used 0))
    (cl-labels ((new-page ()
                  (when page (push (nreverse page) pages))
                  (setq page nil used 0))
                (add (lines)
                  (when (> used 0) (push nil page) (setq used (1+ used)))
                  (dolist (l lines) (push l page) (setq used (1+ used))))
                (room () (- max used (if (> used 0) 1 0))))
      (while blocks
        (pcase-let ((`(,kind ,lines) (car blocks)))
          (cond
           ((eq kind 'page-break) (new-page))
           ((<= (length lines) (room))
            ;; A scene heading needs two lines of what follows on its page
            (when (and (eq kind 'scene-heading) (cadr blocks)
                       (< (room) (+ (length lines) 1 (min 2 (length (cadr (cadr blocks)))))))
              (new-page))
            (add lines))
           ((and (memq kind '(speech scene-heading transition centered lyrics))
                 (<= (length lines) max))
            (new-page)
            (add lines))
           ;; Split: what fits here, the rest on the next page (or pages)
           (t
            (while lines
              (when (< (room) 2) (new-page))
              (let ((here (seq-take lines (room))))
                (add here)
                (setq lines (nthcdr (length here) lines))
                (when lines (new-page)))))))
        (setq blocks (cdr blocks)))
      (new-page))
    (nreverse pages)))

(defconst jg-site--win-ansi
  '((?€ . #x80) (?‚ . #x82) (?ƒ . #x83) (?„ . #x84) (?… . #x85) (?† . #x86) (?‡ . #x87)
    (?ˆ . #x88) (?‰ . #x89) (?Š . #x8A) (?‹ . #x8B) (?Œ . #x8C) (?Ž . #x8E) (?‘ . #x91)
    (?’ . #x92) (?“ . #x93) (?” . #x94) (?• . #x95) (?– . #x96) (?— . #x97) (?˜ . #x98)
    (?™ . #x99) (?š . #x9A) (?› . #x9B) (?œ . #x9C) (?ž . #x9E) (?Ÿ . #x9F))
  "The characters past ASCII that PDF's built-in fonts have, besides Latin-1,
and their codes (WinAnsiEncoding).")

(defun jg-site--pdf-string (chars)
  "CHARS (characters) as a PDF string: (text), escaped, in WinAnsiEncoding."
  (concat "("
          (mapconcat (lambda (c)
                       (let ((code (cond ((< c 128) c)
                                         ((assq c jg-site--win-ansi) (cdr (assq c jg-site--win-ansi)))
                                         ((<= 160 c 255) c)
                                         (t ??))))
                         (cond ((memq code '(?\( ?\) ?\\)) (string ?\\ code))
                               ((< code 128) (string code))
                               (t (format "\\%03o" code)))))
                     chars "")
          ")"))

(defun jg-site--pdf-draw (x y chars)
  "PDF drawing commands for CHARS (from `jg-site--fountain-chars') with
their first at X, Y: a run of text per style, a line under underlined ones."
  (let ((i 0) (n (length chars)) out)
    (while (< i n)
      (let* ((style (cdr (aref chars i)))
             (j (cl-loop for k from i below n
                         unless (equal (cdr (aref chars k)) style) return k
                         finally return n))
             (x0 (+ x (* i jg-site--pdf-char)))
             (font (pcase style
                     (`(t t . ,_) "F4") (`(t nil . ,_) "F2") (`(nil t . ,_) "F3") (_ "F1"))))
        (push (format "BT /%s 12 Tf %.2f %.2f Td %s Tj ET\n" font x0 y
                      (jg-site--pdf-string (mapcar #'car (append (substring chars i j) nil))))
              out)
        (when (nth 2 style)
          (push (format "0.6 w %.2f %.2f m %.2f %.2f l S\n" x0 (- y 1.5)
                        (+ x0 (* (- j i) jg-site--pdf-char)) (- y 1.5))
                out))
        (setq i j)))
    (apply #'concat (nreverse out))))

(defun jg-site--pdf-title-page (keywords)
  "Drawing commands for a title page from the title page's KEYWORDS, or nil."
  (let ((title (jg-site--kw keywords "title")))
    (when title
      (let ((y 540) (out ""))
        (cl-flet ((centered (text)
                    (dolist (line (jg-site--pdf-lines text 324 60 nil 'center))
                      (setq out (concat out (jg-site--pdf-draw (caar line) y (cdar line)))
                            y (- y 12)))))
          (centered (upcase title))
          (dolist (key '("credit" "author" "authors" "source"))
            (let ((value (jg-site--kw keywords key)))
              (when value
                (setq y (- y 24))
                (centered value)))))
        ;; Contact and draft date, bottom left
        (let ((y 72))
          (dolist (key '("draft date" "contact"))
            (let ((value (jg-site--kw keywords key)))
              (when value
                (dolist (line (reverse (jg-site--pdf-lines value 108 40)))
                  (setq out (concat out (jg-site--pdf-draw (caar line) y (cdar line)))
                        y (+ y 12)))
                (setq y (+ y 12))))))
        out))))

(defun jg-site--write-script-pdf (keywords text out)
  "Write the screenplay TEXT (its body), with the title page KEYWORDS, as a
PDF to the file OUT."
  (let* ((title-page (jg-site--pdf-title-page keywords))
         (pages (jg-site--pdf-paginate (jg-site--pdf-blocks (jg-site--fountain-parse text))))
         (streams
          (append
           (and title-page (list title-page))
           (let ((number 0))
             (mapcar
              (lambda (page)
                (setq number (1+ number))
                (concat
                 ;; Page numbers from the second page on, top right
                 (if (> number 1)
                     (let ((label (format "%d." number)))
                       (format "BT /F1 12 Tf %.2f 756 Td %s Tj ET\n"
                               (- 540 (* (length label) jg-site--pdf-char))
                               (jg-site--pdf-string (string-to-list label))))
                   "")
                 (let ((row -1))
                   (mapconcat (lambda (line)
                                (setq row (1+ row))
                                (mapconcat (lambda (item)
                                             (jg-site--pdf-draw (car item) (- 710 (* 12 row)) (cdr item)))
                                           line ""))
                              page ""))))
              pages))))
         (fonts '("Courier" "Courier-Bold" "Courier-Oblique" "Courier-BoldOblique"))
         ;; Objects: 1 catalog, 2 page list, 3 info, 4-7 fonts, then a page
         ;; and its contents for each page
         (first-page 8)
         (objects
          (append
           (list "<< /Type /Catalog /Pages 2 0 R >>"
                 (format "<< /Type /Pages /Count %d /Kids [%s] >>" (length streams)
                         (mapconcat (lambda (i) (format "%d 0 R" (+ first-page (* 2 i))))
                                    (number-sequence 0 (1- (length streams))) " "))
                 (format "<< /Title %s /Author (Jack Gilmore) /Creator (jackgilmorecreative.com) >>"
                         (jg-site--pdf-string
                          (string-to-list (replace-regexp-in-string
                                           "[*_]" "" (or (jg-site--kw keywords "title") "Script"))))))
           (mapcar (lambda (font)
                     (format "<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding /WinAnsiEncoding >>" font))
                   fonts)
           (let ((i -1))
             (apply #'append
                    (mapcar (lambda (stream)
                              (setq i (1+ i))
                              (list (format "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> >>"
                                            (+ first-page (* 2 i) 1))
                                    (format "<< /Length %d >>\nstream\n%sendstream" (length stream) stream)))
                            streams)))))
         (offsets nil)
         (pdf "%PDF-1.4\n"))
    (let ((n 0))
      (dolist (object objects)
        (setq n (1+ n))
        (push (length pdf) offsets)
        (setq pdf (concat pdf (format "%d 0 obj\n%s\nendobj\n" n object)))))
    (let ((xref (length pdf)))
      (setq pdf (concat pdf
                        (format "xref\n0 %d\n0000000000 65535 f \n" (1+ (length objects)))
                        (mapconcat (lambda (offset) (format "%010d 00000 n \n" offset))
                                   (nreverse offsets) "")
                        (format "trailer\n<< /Size %d /Root 1 0 R /Info 3 0 R >>\nstartxref\n%d\n%%%%EOF\n"
                                (1+ (length objects)) xref))))
    (let ((coding-system-for-write 'us-ascii))
      (with-temp-file out
        (set-buffer-multibyte nil)
        (insert pdf)))))

(defun jg-site--export-fountain (file url)
  "Export the Fountain screenplay FILE as the writing page at site URL."
  (let* ((script (jg-site--fountain-read file))
         (kw (mapcar (lambda (kv)
                       (if (equal (car kv) "title")
                           (cons "title" (replace-regexp-in-string "[*_]" "" (cdr kv)))
                         kv))
                     (car script)))
         (out-file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
         (pdf-name (concat (file-name-base file) ".pdf"))
         (coding-system-for-write 'utf-8))
    (make-directory (file-name-directory out-file) t)
    (jg-site--write-script-pdf (car script) (cdr script)
                               (expand-file-name pdf-name (file-name-directory out-file)))
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
        :actions (format "<a class=\"action-link\" href=\"%s\" download>Download PDF</a>"
                         (url-hexify-string pdf-name))
        :head "<link href=\"https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap\" rel=\"stylesheet\">\n"
        :contents (jg-site--fountain-html (cdr script)))))))


;;; Books
;;
;; A piece with #+type: book is a book. Each top-level heading is a chapter;
;; whatever comes before the first one is a few words about the book, shown on
;; its page above the contents. #+cover: is its cover picture (portrait, 2:3
;; is a book's shape), a path from the Org file like an image link's:
;;
;;   #+title: The Long Road
;;   #+type: book
;;   #+cover: media/the-long-road/cover.jpg
;;   #+description: One line for the Read page.
;;
;;   A few words about the book.
;;
;;   * The First Chapter
;;   ...
;;
;; It becomes:
;;
;;   writing/the-long-road.html            its page: cover, about, contents, download
;;   writing/the-long-road/chapter-1.html  each chapter, with previous and next
;;   writing/the-long-road.epub            the whole book, for e-readers
;;
;; A COMMENTed heading, or one tagged :noexport:, is left out (an unfinished
;; chapter, say). The EPUB is EPUB 3: a zip of XHTML pages with a list of
;; them (content.opf) and a table of contents (nav.xhtml), which Apple Books,
;; Kobo, Kindle (through Send to Kindle) and the rest all read.

(defun jg-site--book-p (keywords)
  "Non-nil if KEYWORDS (a piece's) say it's a book."
  (equal (downcase (or (jg-site--kw keywords "type") "")) "book"))

(defun jg-site--book-cover (file keywords)
  "The cover picture FILE's #+cover: (in KEYWORDS) names, as a full file name,
or nil if there's none (or it isn't there)."
  (let ((cover (jg-site--kw keywords "cover")))
    (when cover
      (let ((path (expand-file-name
                   (string-remove-prefix "file:" (replace-regexp-in-string
                                                  "\\`\\[\\[\\|\\]\\(?:\\[.*\\)?\\]\\'" "" cover))
                   (file-name-directory file))))
        (and (file-regular-p path) path)))))

(defun jg-site--book-cover-url (file cover)
  "The site URL the COVER of the book FILE is published at."
  (format "/writing/media/%s/%s" (url-hexify-string (file-name-base file))
          (url-hexify-string (file-name-nondirectory cover))))

(defun jg-site--chapter-regions ()
  "The chapters in the current (Org) buffer: (TITLE BEGIN END) for each
top-level heading that isn't COMMENTed or :noexport:. BEGIN is where its
text starts (after its heading and properties), END where the next starts."
  (let (chapters)
    (org-map-entries
     (lambda ()
       (when (and (= (org-current-level) 1)
                  (not (org-in-commented-heading-p))
                  (not (member "noexport" (org-get-tags nil t))))
         (push (list (org-get-heading t t t t)
                     (save-excursion (org-end-of-meta-data t) (point))
                     (save-excursion (org-end-of-subtree t t) (point)))
               chapters))))
    (nreverse chapters)))

(defun jg-site--chapter-url (file n)
  "The site URL of chapter N of the book FILE."
  (format "/writing/%s/chapter-%d.html" (url-hexify-string (file-name-base file)) n))

(defun jg-site--book-chapters (file)
  "The chapters of the book FILE, as alists (title, url, words)."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (let ((org-inhibit-startup t)) (delay-mode-hooks (org-mode)))
    (let ((n 0))
      (mapcar (lambda (chapter)
                (setq n (1+ n))
                `((title . ,(nth 0 chapter))
                  (url . ,(jg-site--chapter-url file n))
                  (words . ,(count-words (nth 1 chapter) (nth 2 chapter)))))
              (jg-site--chapter-regions)))))

(defun jg-site--reading-time (words)
  "How long WORDS take to read: \"12 min\", \"3 hr 5 min\"."
  (let ((minutes (max 1 (round words 230.0))))
    (if (< minutes 60)
        (format "%d min" minutes)
      (format "%d hr%s" (/ minutes 60)
              (if (zerop (% minutes 60)) "" (format " %d min" (% minutes 60)))))))

(defun jg-site--export-body (url out-dir)
  "The accessible part of the current buffer, exported as the body of the page
at site URL (in OUT-DIR, where its images are copied to)."
  (org-export-as 'jg-site nil nil t
                 (list :jg-kind 'writing :jg-out-dir out-dir :jg-url url
                       :html-doctype "html5" :html-html5-fancy t)))

(defun jg-site--write-page (url html)
  "Write HTML as the page at site URL."
  (let ((out-file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
        (coding-system-for-write 'utf-8))
    (make-directory (file-name-directory out-file) t)
    (with-temp-file out-file (insert html))))

(defun jg-site--export-book (file url)
  "Export the book FILE: its page at site URL, a page per chapter, and an EPUB."
  (let* ((kw (jg-site--keywords file))
         (base (file-name-base file))
         (title (jg-site--escape (or (jg-site--kw kw "title") base)))
         (description (or (jg-site--kw kw "description") ""))
         (date (jg-site--date (jg-site--kw kw "date")))
         (cover (jg-site--book-cover file kw))
         (writing-dir (expand-file-name "writing/" jg-site-root))
         (chapter-dir (expand-file-name (concat "writing/" base "/") jg-site-root))
         (epub-url (format "/writing/%s.epub" (url-hexify-string base)))
         (org-inhibit-startup t)
         (visiting (find-buffer-visiting file))
         (buffer (or visiting (let ((coding-system-for-read 'utf-8))
                                (find-file-noselect file))))
         about chapters)
    ;; Export the about and each chapter, each on its own (narrowed to it)
    (unwind-protect
        (with-current-buffer buffer
          (save-restriction
            (widen)
            (let ((regions (jg-site--chapter-regions))
                  (n 0))
              (narrow-to-region (point-min) (if regions
                                                (save-excursion (goto-char (nth 1 (car regions)))
                                                                (org-back-to-heading t)
                                                                (point))
                                              (point-max)))
              (setq about (string-trim (jg-site--export-body url writing-dir)))
              (dolist (region regions)
                (setq n (1+ n))
                (widen)
                (narrow-to-region (nth 1 region) (nth 2 region))
                (push `((number . ,n)
                        (title . ,(jg-site--escape (nth 0 region)))
                        (url . ,(jg-site--chapter-url file n))
                        (words . ,(count-words (point-min) (point-max)))
                        (html . ,(jg-site--export-body (jg-site--chapter-url file n) chapter-dir)))
                      chapters)))))
      (unless visiting (kill-buffer buffer)))
    (setq chapters (nreverse chapters))
    (when cover
      (make-directory (expand-file-name (concat "media/" base "/") writing-dir) t)
      (copy-file cover (expand-file-name (concat "media/" base "/" (file-name-nondirectory cover))
                                         writing-dir)
                 t))
    (let* ((cover-src (and cover (substring (jg-site--book-cover-url file cover) (length "/writing/"))))
           (words (apply #'+ 0 (mapcar (lambda (c) (alist-get 'words c)) chapters)))
           (crumbs "<a href=\"/read.html\">Read</a><a href=\"/read.html#writing\">Books</a>"))
      ;; The book's page
      (jg-site--write-page
       url
       (jg-site--page
        :kind 'writing :title title :type "book" :date date :url url
        :description description :crumbs crumbs :article-class "book"
        :header ""
        :contents
        (concat
         "<div class=\"book-hero\">\n<div class=\"book-cover\">"
         (if cover-src
             (format "<img src=\"%s\" alt=\"The cover of %s\">" cover-src title)
           (format "<span class=\"book-cover-blank\"><span>%s</span></span>" title))
         "</div>\n<div class=\"book-info\">\n<p class=\"eyebrow\">Book</p>\n<h1>" title "</h1>\n"
         "<p class=\"byline\">"
         (string-join (delq nil (list (jg-site--pretty-date date)
                                      (format "%d chapter%s" (length chapters)
                                              (if (= (length chapters) 1) "" "s"))
                                      (concat (jg-site--reading-time words) " read")))
                      " · ")
         "</p>\n"
         (if (string-empty-p description) ""
           (format "<p class=\"book-desc\">%s</p>\n" (jg-site--escape description)))
         "<div class=\"book-actions\">"
         (if chapters
             (format "<a class=\"button button-primary\" href=\"%s\">Start reading</a>"
                     (alist-get 'url (car chapters)))
           "")
         (format "<a class=\"button\" href=\"%s\" download>Download EPUB</a>" epub-url)
         jg-site--share-button
         "</div>\n<p class=\"book-epub-note\">The EPUB opens in Apple Books, Kobo and most e-readers; for a Kindle, use Send to Kindle.</p>\n"
         "</div>\n</div>\n"
         (if (string-empty-p about) "" (concat "<div class=\"prose book-about\">\n" about "\n</div>\n"))
         "<section class=\"book-toc\">\n<h2>Contents</h2>\n<ol>\n"
         (mapconcat (lambda (c)
                      (format "<li><a href=\"%s\"><span class=\"toc-num\">%d</span><span class=\"toc-title\">%s</span><span class=\"toc-meta\">%s</span></a></li>"
                              (alist-get 'url c) (alist-get 'number c) (alist-get 'title c)
                              (jg-site--reading-time (alist-get 'words c))))
                    chapters "\n")
         "\n</ol>\n</section>")))
      ;; A page per chapter, with the way to the next (and back)
      (let ((prev nil) (rest chapters))
        (while rest
          (let* ((c (car rest))
                 (next (cadr rest))
                 (link (lambda (c label class)
                         (format "<a class=\"%s\" href=\"%s\" rel=\"%s\"><span class=\"chapter-nav-label\">%s</span><span class=\"chapter-nav-title\">%s</span></a>"
                                 class (alist-get 'url c) class label (alist-get 'title c)))))
            (jg-site--write-page
             (alist-get 'url c)
             (jg-site--page
              :kind 'writing :title (alist-get 'title c) :type "book" :url (alist-get 'url c)
              :crumbs (concat crumbs (format "<a href=\"%s\">%s</a>" url title))
              :eyebrow (format "Chapter %d" (alist-get 'number c))
              :byline (format "<a href=\"%s\">%s</a> · %s read" url title
                              (jg-site--reading-time (alist-get 'words c)))
              :head (concat (if prev (format "<link rel=\"prev\" href=\"%s\">\n" (alist-get 'url prev)) "")
                            (if next (format "<link rel=\"next\" href=\"%s\">\n" (alist-get 'url next)) ""))
              :contents (alist-get 'html c)
              :after (concat "<nav class=\"chapter-nav\" aria-label=\"Chapters\">"
                             (if prev (funcall link prev "← Previous" "prev") "<span></span>")
                             (format "<a class=\"chapter-nav-toc\" href=\"%s\">Contents</a>" url)
                             (if next (funcall link next "Next →" "next")
                               (format "<a class=\"next\" href=\"%s\"><span class=\"chapter-nav-label\">The end</span><span class=\"chapter-nav-title\">Back to %s</span></a>"
                                       url title))
                             "</nav>\n")))
            (setq prev c rest (cdr rest)))))
      (jg-site--write-epub file title description date cover chapters about chapter-dir))))

(defun jg-site--xhtml (html base-url)
  "HTML (from Org's export) as XHTML for an EPUB: tags like <img> closed,
named entities as characters (XML only knows five), and links that aren't to
pictures inside the book made full addresses, relative to BASE-URL. Org's
made-up ids (id=\"org1a2b3c\", new each export) go, unless something links to
one, so an unchanged book makes the same EPUB."
  (thread-last
    html
    (replace-regexp-in-string
     " id=\"\\([a-z-]*org[0-9a-f]+\\)\""
     (lambda (match)
       (if (string-search (concat "#" (match-string 1 match) "\"") html) match "")))
    ;; <img ...> -> <img .../>
    (replace-regexp-in-string "<\\(img\\|br\\|hr\\|wbr\\|source\\|col\\)\\b\\([^>]*?\\)[ \t]*/?>" "<\\1\\2/>")
    ;; `download' has no value, which XML doesn't allow
    (replace-regexp-in-string " download\\([ >]\\)" "\\1")
    (replace-regexp-in-string
     "&\\([a-zA-Z][a-zA-Z0-9]*\\);"
     (lambda (match)
       (let ((name (match-string 1 match)))
         (if (member name '("amp" "lt" "gt" "quot" "apos"))
             match
           (or (cdr (assoc name jg-site--entities))
               (let ((entity (seq-find (lambda (e) (and (consp e) (equal (nth 3 e) match)))
                                       (append org-entities-user org-entities))))
                 (and entity (nth 6 entity)))
               "")))))
    (replace-regexp-in-string
     "href=\"\\([^\"]+\\)\""
     (lambda (match)
       (let ((link (match-string 1 match)))
         (if (string-match-p "\\`\\(?:[a-z]+:\\|#\\)" link)
             match
           (format "href=\"%s\"" (url-expand-file-name link base-url))))))))

(defconst jg-site--media-types
  '(("jpg" . "image/jpeg") ("jpeg" . "image/jpeg") ("png" . "image/png")
    ("gif" . "image/gif") ("webp" . "image/webp") ("svg" . "image/svg+xml"))
  "The pictures an EPUB can hold, by extension.")

(defun jg-site--media-type (file)
  (cdr (assoc (downcase (or (file-name-extension file) "")) jg-site--media-types)))

(defun jg-site--xhtml-page (title body)
  "An EPUB page called TITLE (escaped) around BODY (XHTML)."
  (concat "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE html>\n"
          "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\" lang=\"en\" xml:lang=\"en\">\n"
          "<head>\n<meta charset=\"UTF-8\"/>\n<title>" title "</title>\n"
          "<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\"/>\n</head>\n<body>\n"
          body "\n</body>\n</html>\n"))

(defconst jg-site--epub-css
  "body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1 { font-size: 1.6em; text-align: center; margin: 2em 0 0.3em; }
.chapter-number { text-align: center; text-transform: uppercase; letter-spacing: 0.15em; font-size: 0.8em; margin-top: 3em; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, figure + p, hr + p, .chapter-number + h1 + p { text-indent: 0; }
figure { margin: 1.5em 0; text-align: center; }
img { max-width: 100%; }
figcaption { font-size: 0.85em; font-style: italic; }
blockquote { margin: 1em 2em; font-style: italic; }
.title-page { text-align: center; margin-top: 30%; }
.title-page .author { font-style: italic; margin-top: 1em; }
.about { margin-top: 3em; }
.about p { text-indent: 0; margin-bottom: 0.8em; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-height: 100%; }
"
  "The EPUB's styles: plain, so the e-reader's own settings win.")

(defun jg-site--write-epub (file title description date cover chapters about chapter-dir)
  "Write the book FILE as an EPUB: TITLE (escaped), DESCRIPTION, DATE, COVER
(a file or nil), CHAPTERS (as `jg-site--export-book' made them), the ABOUT
text (HTML), and the pictures that CHAPTER-DIR's media/ holds for them."
  (let* ((base (file-name-base file))
         (book-url (concat jg-site-url (jg-site--url "writing" file)))
         (out (expand-file-name (concat "writing/" base ".epub") jg-site-root))
         (stage (make-temp-file "jg-epub" t))
         (oebps (expand-file-name "OEBPS/" stage))
         (cover-name (and cover (concat "cover." (downcase (file-name-extension cover)))))
         (stamp (date-to-time (concat (or date "2026-01-01") " 12:00")))
         (write (lambda (name text)
                  (let ((path (expand-file-name name stage))
                        (coding-system-for-write 'utf-8))
                    (make-directory (file-name-directory path) t)
                    (with-temp-file path (insert text)))))
         (items nil))
    (unwind-protect
        (progn
          (funcall write "mimetype" "application/epub+zip")
          (funcall write "META-INF/container.xml"
                   "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">
<rootfiles><rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles>
</container>
")
          (funcall write "OEBPS/style.css" jg-site--epub-css)
          ;; Cover, title page, chapters
          (when cover
            (copy-file cover (expand-file-name cover-name oebps) t)
            (funcall write "OEBPS/cover.xhtml"
                     (jg-site--xhtml-page title (format "<div class=\"cover\"><img src=\"%s\" alt=\"The cover of %s\"/></div>"
                                                        cover-name title))))
          (funcall write "OEBPS/title.xhtml"
                   (jg-site--xhtml-page
                    title
                    (concat "<section epub:type=\"titlepage\" class=\"title-page\">\n<h1>" title "</h1>\n"
                            "<p class=\"author\">Jack Gilmore</p>\n</section>\n"
                            (if (string-empty-p about) ""
                              (concat "<section class=\"about\">\n" (jg-site--xhtml about book-url) "\n</section>")))))
          (dolist (c chapters)
            (let ((n (alist-get 'number c)))
              (funcall write (format "OEBPS/chapter-%d.xhtml" n)
                       (jg-site--xhtml-page
                        (alist-get 'title c)
                        (concat "<section epub:type=\"chapter\">\n"
                                (format "<p class=\"chapter-number\">Chapter %d</p>\n<h1>%s</h1>\n"
                                        n (alist-get 'title c))
                                (jg-site--xhtml (alist-get 'html c)
                                                (concat jg-site-url (alist-get 'url c)))
                                "\n</section>")))))
          ;; The chapters' pictures, at the same relative paths (media/chapter-N/...)
          (let ((media (expand-file-name "media/" chapter-dir)))
            (when (file-directory-p media)
              (copy-directory media (expand-file-name "media/" oebps) nil t t)
              (dolist (f (directory-files-recursively (expand-file-name "media/" oebps) ""))
                (if (jg-site--media-type f)
                    (push (file-relative-name f oebps) items)
                  (delete-file f)))))
          (funcall write "OEBPS/nav.xhtml"
                   (jg-site--xhtml-page
                    "Contents"
                    (concat "<nav epub:type=\"toc\" id=\"toc\">\n<h1>Contents</h1>\n<ol>\n"
                            (mapconcat (lambda (c) (format "<li><a href=\"chapter-%d.xhtml\">%s</a></li>"
                                                           (alist-get 'number c) (alist-get 'title c)))
                                       chapters "\n")
                            "\n</ol>\n</nav>")))
          (funcall write "OEBPS/content.opf"
                   (concat
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                    "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\" xml:lang=\"en\">\n"
                    "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                    (format "<dc:identifier id=\"bookid\">%s</dc:identifier>\n" book-url)
                    (format "<dc:title>%s</dc:title>\n" title)
                    "<dc:creator>Jack Gilmore</dc:creator>\n<dc:language>en</dc:language>\n"
                    (if date (format "<dc:date>%s</dc:date>\n" date) "")
                    (if (string-empty-p description) ""
                      (format "<dc:description>%s</dc:description>\n" (jg-site--escape description)))
                    (format "<meta property=\"dcterms:modified\">%s</meta>\n"
                            (format-time-string "%Y-%m-%dT%H:%M:%SZ" stamp t))
                    (if cover "<meta name=\"cover\" content=\"cover-image\"/>\n" "")
                    "</metadata>\n<manifest>\n"
                    "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>\n"
                    "<item id=\"css\" href=\"style.css\" media-type=\"text/css\"/>\n"
                    (if cover
                        (format "<item id=\"cover-image\" href=\"%s\" media-type=\"%s\" properties=\"cover-image\"/>\n<item id=\"cover\" href=\"cover.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                                cover-name (jg-site--media-type cover-name))
                      "")
                    "<item id=\"title\" href=\"title.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                    (mapconcat (lambda (c) (format "<item id=\"chapter-%d\" href=\"chapter-%d.xhtml\" media-type=\"application/xhtml+xml\"/>"
                                                   (alist-get 'number c) (alist-get 'number c)))
                               chapters "\n")
                    "\n"
                    (let ((i 0))
                      (mapconcat (lambda (item)
                                   (setq i (1+ i))
                                   (format "<item id=\"media-%d\" href=\"%s\" media-type=\"%s\"/>"
                                           i (url-hexify-string item url-path-allowed-chars)
                                           (jg-site--media-type item)))
                                 (sort items #'string<) "\n"))
                    "\n</manifest>\n<spine>\n"
                    (if cover "<itemref idref=\"cover\" linear=\"no\"/>\n" "")
                    "<itemref idref=\"title\"/>\n"
                    (mapconcat (lambda (c) (format "<itemref idref=\"chapter-%d\"/>" (alist-get 'number c)))
                               chapters "\n")
                    "\n</spine>\n</package>\n"))
          ;; The same date on every file, so an unchanged book makes the same
          ;; zip (and git sees no change)
          (dolist (f (cons stage (directory-files-recursively stage "" t)))
            (set-file-times f stamp))
          ;; mimetype first and uncompressed, as EPUB requires; then the rest
          (when (file-exists-p out) (delete-file out))
          (let ((default-directory (file-name-as-directory stage)))
            (unless (and (eq 0 (call-process "zip" nil nil nil "-X" "-0" "-q" out "mimetype"))
                         (eq 0 (apply #'call-process "zip" nil nil nil "-X" "-9" "-q" out
                                      (sort (delete "mimetype"
                                                    (mapcar (lambda (f) (file-relative-name f stage))
                                                            (seq-filter #'file-regular-p
                                                                        (directory-files-recursively stage ""))))
                                            #'string<))))
              (error "Couldn't make %s (is zip installed?)" out))))
      (delete-directory stage t))))


;;; Publication dates
;;
;; A piece's date is the day it went online, not the day it was started. Each
;; publish asks git which pages were in the last commit. A page about to be
;; published that wasn't (a draft just made public, a note just tagged
;; publish) gets today's date written into its file: #+date: in Org, Date: or
;; Draft date: in a screenplay. New videos and comics get it in :DATE:. So if
;; you publish (SPC n w p) one day and push the next, the date moves to the
;; day it was pushed: the day it went live is what counts.

(defvar jg-site-newly-published nil
  "The pages the last `jg-site-publish' put online for the first time, as
alists (title, type, url...). Emacs cross-posts the blog posts among them.")

(defun jg-site--today ()
  (format-time-string "%Y-%m-%d"))

(defun jg-site--git (&rest args)
  "Run git with ARGS in the site's folder: its output, or nil if it failed."
  (with-temp-buffer
    (let ((default-directory jg-site-root)
          (coding-system-for-read 'utf-8))
      (and (eq 0 (ignore-errors (apply #'process-file "git" nil t nil args)))
           (buffer-string)))))

(defun jg-site--committed-files ()
  "The files in the last commit, as a hash table, or nil if git can't say."
  (let ((out (jg-site--git "ls-tree" "-r" "-z" "--name-only" "HEAD")))
    (when out
      (let ((files (make-hash-table :test #'equal)))
        (dolist (file (split-string out "\0" t))
          (puthash file t files))
        files))))

(defun jg-site--edit-file (file edit)
  "Call EDIT in a buffer holding FILE, and save FILE if EDIT changed it.
If FILE is open in Emacs, its buffer is edited and saved, so it never goes
stale; otherwise a temporary buffer is."
  (let ((visiting (find-buffer-visiting file)))
    (if visiting
        (with-current-buffer visiting
          (let ((tick (buffer-chars-modified-tick)))
            (save-excursion (save-restriction (widen) (funcall edit)))
            (unless (= tick (buffer-chars-modified-tick))
              (save-buffer))))
      (with-temp-buffer
        (let ((coding-system-for-read 'utf-8))
          (insert-file-contents file))
        (let ((before (buffer-string)))
          (funcall edit)
          (unless (equal before (buffer-string))
            (let ((coding-system-for-write 'utf-8))
              (write-region nil nil file nil 'quiet))))))))

(defun jg-site--set-date (fountain)
  "Make the current buffer's date today: its #+date:, or for a FOUNTAIN
screenplay its title page's Date: (else Draft date:). Adds one if missing."
  (let ((case-fold-search t)
        (today (jg-site--today)))
    (goto-char (point-min))
    (if fountain
        (let ((end (save-excursion (if (re-search-forward "^[ \t]*$" nil t) (point) (point-max)))))
          (cond ((re-search-forward "^Date:[ \t]*\\(.*?\\)[ \t]*$" end t)
                 (replace-match today t t nil 1))
                ((progn (goto-char (point-min))
                        (re-search-forward "^Draft date:[ \t]*\\(.*?\\)[ \t]*$" end t))
                 (replace-match today t t nil 1))
                (t (goto-char end)
                   (insert "Draft date: " today "\n"))))
      (cond ((re-search-forward "^#\\+date:[ \t]*\\(.*?\\)[ \t]*$" nil t)
             (replace-match today t t nil 1))
            ((re-search-forward "^#\\+title:.*$" nil t)
             (insert "\n#+date: " today))))))

(defun jg-site--date-new-pages (pages committed)
  "Date today each of PAGES (pieces or notes) whose page isn't in COMMITTED.
Return their URLs."
  (let (urls)
    (dolist (page pages)
      (let ((url (alist-get 'url page))
            (file (alist-get 'file page)))
        (unless (gethash (url-unhex-string (substring url 1)) committed)
          (jg-site--edit-file file (lambda () (jg-site--set-date (jg-site--fountain-p file))))
          (push url urls))))
    urls))

(defun jg-site--entry-in-p (text)
  "Non-nil if the Org heading at point was already in TEXT (an older copy of
its file): a heading there has its title, or TEXT has one of its links."
  (let ((title (org-get-heading t t t t))
        (end (save-excursion (outline-next-heading) (point)))
        links)
    (save-excursion
      (while (re-search-forward "\\(?:https?://\\|file:\\)[^]\" \t\n]+" end t)
        (push (match-string 0) links)))
    (or (string-match-p (concat "^\\*+[ \t]+\\(?:COMMENT[ \t]+\\)?" (regexp-quote title)
                                "[ \t]*\\(?::[[:alnum:]_@#%:]+:\\)?[ \t]*$")
                        text)
        (seq-some (lambda (link) (string-search link text)) links))))

(defun jg-site--date-new-entries (file committed)
  "Date today each new video or comic in FILE (relative to content/): a
heading with a :DATE: that wasn't in the last commit's copy of FILE."
  (let* ((rel (concat "content/" file))
         (path (expand-file-name rel jg-site-root))
         (old (and (gethash rel committed) (jg-site--git "show" (concat "HEAD:" rel))))
         (today (jg-site--today)))
    (when (and old (file-exists-p path))
      (jg-site--edit-file
       path
       (lambda ()
         (unless (derived-mode-p 'org-mode)
           (let ((org-inhibit-startup t)) (delay-mode-hooks (org-mode))))
         (org-map-entries
          (lambda ()
            (let ((date (org-entry-get nil "DATE")))
              (when (and date
                         (not (equal date today))
                         (not (org-in-commented-heading-p))
                         (not (jg-site--entry-in-p old)))
                (org-entry-put nil "DATE" today))))))))))


;;; The blog's RSS feed
;;
;; feed.xml lists the newest blog posts, each with its whole text, so a feed
;; reader (Feedly, NetNewsWire...) shows new posts as they go up. Every page's
;; <head> points to it, which is how readers find it from the site's address.

(defvar jg-site-feed-size 20 "How many of the newest blog posts the feed lists.")

(defun jg-site--rfc822 (iso)
  "ISO (YYYY-MM-DD) as RSS wants dates: \"Wed, 28 Oct 2026 12:00:00 -0400\"."
  (let ((system-time-locale "C"))
    (format-time-string "%a, %d %b %Y %H:%M:%S %z" (date-to-time (concat iso " 12:00")))))

(defun jg-site--feed-body (url)
  "The exported text of the page at URL, for the feed: what's between its
title and the end of the article, with its links made full addresses."
  (let ((file (expand-file-name (url-unhex-string (substring url 1)) jg-site-root)))
    (with-temp-buffer
      (let ((coding-system-for-read 'utf-8))
        (insert-file-contents file))
      (goto-char (point-min))
      (let* ((start (and (search-forward "</header>" nil t) (point)))
             (end (and start (search-forward "</article>" nil t) (match-beginning 0))))
        (if (not end)
            ""
          (replace-regexp-in-string
           "\\(\\(?:src\\|href\\)=\"\\)\\([^\"]+\\)\""
           (lambda (match)
             (let ((attr (match-string 1 match))
                   (link (match-string 2 match)))
               (if (string-match-p "\\`\\(?:[a-z]+:\\|#\\)" link)
                   match
                 (concat attr (url-expand-file-name link (concat jg-site-url url)) "\""))))
           (string-trim (buffer-substring start end)) t t))))))

;; ---- Instagram slides ----
;;
;; Every blog post also becomes square pictures for Instagram, drawn by
;; tools/slides.swift: its picture (or the site's card), its text in Georgia
;; over as many slides as it takes, and a slide about the site; and a
;; phone-sized picture for the story, pointing people to the website. They're
;; written to social/SLUG/1.jpg, 2.jpg... and story.jpg, and pushed with the
;; site, so Instagram can fetch them when Emacs cross-posts the post: the
;; slides as a carousel, then the story.
;; The tool is compiled once (into ~/.cache/jg-site/) and only redraws a
;; post's slides when the post or the tool has changed (social/SLUG/key holds
;; what they were drawn from). Without Swift (not a Mac), there are no slides
;; and Instagram gets the single picture instead.

(defconst jg-site-slides-max 8
  "The most text slides a post gets. With its picture and the slide about the
site that's 10, the most an Instagram carousel can hold.")

(defun jg-site--slides-tool ()
  "The compiled slides tool, compiling it if it isn't yet; nil without Swift."
  (let* ((source (expand-file-name "tools/slides.swift" jg-site-root))
         (hash (with-temp-buffer
                 (insert-file-contents-literally source)
                 (md5 (current-buffer))))
         (tool (expand-file-name (concat "jg-site/slides-" hash)
                                 (or (getenv "XDG_CACHE_HOME") "~/.cache/"))))
    (cond ((file-executable-p tool) tool)
          ((not (executable-find "swiftc")) nil)
          (t (make-directory (file-name-directory tool) t)
             ;; Builds of older versions of the tool
             (dolist (old (directory-files (file-name-directory tool) t "\\`slides-"))
               (delete-file old))
             (message "Compiling the Instagram slides tool (once)...")
             (and (eq 0 (call-process "swiftc" nil nil nil "-O" source "-o" tool))
                  tool)))))

(defun jg-site--slides-page (url)
  "The page at URL's description and picture file: (DESCRIPTION . FILE).
FILE is \"\" when it has no picture of its own."
  (cons (with-temp-buffer
          (insert-file-contents (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
          (if (re-search-forward "<meta name=\"description\" content=\"\\([^\"]*\\)\"" nil t)
              (jg-site--unescape (match-string 1))
            ""))
        (jg-site--slides-cover url)))

(defun jg-site--slides-cover (url)
  "The picture file of the page at URL, for its first slide, or \"\" for none."
  (with-temp-buffer
    (insert-file-contents (expand-file-name (url-unhex-string (substring url 1)) jg-site-root))
    (let ((image (and (re-search-forward "<meta property=\"og:image\" content=\"\\([^\"]+\\)\"" nil t)
                      (match-string 1))))
      (if (and image
               (string-prefix-p (concat jg-site-url "/writing/") image)
               (string-match-p "\\.\\(jpe?g\\|png\\)\\'" image))
          (expand-file-name (url-unhex-string (substring image (1+ (length jg-site-url)))) jg-site-root)
        ""))))

(defun jg-site--write-slides (writing)
  "Draw the Instagram slides for every blog post in WRITING (already exported)."
  (let ((posts (seq-filter (lambda (p) (equal (alist-get 'type p) "blog")) writing))
        (social (expand-file-name "social/" jg-site-root))
        (tool (jg-site--slides-tool))
        (drawn 0))
    (if (not tool)
        (message "No Swift here, so no Instagram slides")
      ;; Slides of posts that are gone (or no longer blog posts)
      (when (file-directory-p social)
        (let ((slugs (mapcar (lambda (p) (file-name-base (alist-get 'file p))) posts)))
          (dolist (dir (directory-files social nil "\\`[^.]"))
            (unless (member dir slugs)
              (delete-directory (expand-file-name dir social) t)))))
      (dolist (post posts)
        (let* ((url (alist-get 'url post))
               (out (expand-file-name (file-name-base (alist-get 'file post)) social))
               (spec (json-encode
                      `((title . ,(alist-get 'title post))
                        (date . ,(or (jg-site--pretty-date (alist-get 'date post)) ""))
                        (description . ,(car (jg-site--slides-page url)))
                        (html . ,(replace-regexp-in-string
                                  "<figure\\(?:.\\|\n\\)*?</figure>\\|<img[^>]*>" ""
                                  (jg-site--feed-body url)))
                        (cover . ,(jg-site--slides-cover url))
                        (card . ,(expand-file-name "og.png" jg-site-root))
                        (out . ,out)
                        (site . ,(string-remove-prefix "https://" jg-site-url))
                        (max . ,jg-site-slides-max))))
               (key (md5 (concat spec tool)))
               (key-file (expand-file-name "key" out)))
          (unless (and (file-exists-p key-file)
                       (equal key (with-temp-buffer (insert-file-contents key-file) (buffer-string))))
            (let ((spec-file (make-temp-file "jg-slides" nil ".json" spec)))
              (unwind-protect
                  (if (eq 0 (call-process tool nil nil nil spec-file))
                      (progn (with-temp-file key-file (insert key))
                             (setq drawn (1+ drawn)))
                    (message "Couldn't draw the Instagram slides for %s" url))
                (delete-file spec-file))))))
      (when (> drawn 0)
        (message "Drew Instagram slides for %d post%s" drawn (if (= drawn 1) "" "s"))))))

(defun jg-site--write-feed (writing)
  "Write feed.xml: the newest blog posts in WRITING (already exported)."
  (let* ((posts (seq-take (seq-filter (lambda (p) (equal (alist-get 'type p) "blog")) writing)
                          jg-site-feed-size))
         (newest (alist-get 'date (car posts)))
         (coding-system-for-write 'utf-8))
    (with-temp-file (expand-file-name "feed.xml" jg-site-root)
      (insert "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
              "<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\""
              " xmlns:content=\"http://purl.org/rss/1.0/modules/content/\">\n<channel>\n"
              "<title>Jack Gilmore — Blog</title>\n"
              (format "<link>%s/read.html#blog</link>\n" jg-site-url)
              "<description>Blog posts from Jack Gilmore, animator and writer.</description>\n"
              "<language>en-us</language>\n"
              (format "<atom:link href=\"%s/feed.xml\" rel=\"self\" type=\"application/rss+xml\"/>\n"
                      jg-site-url)
              (format "<image><url>%s/apple-touch-icon.png</url><title>Jack Gilmore — Blog</title><link>%s/read.html#blog</link></image>\n"
                      jg-site-url jg-site-url)
              ;; The newest post's date, not now: the file only changes when a post does
              (if (and newest (not (string-empty-p newest)))
                  (format "<lastBuildDate>%s</lastBuildDate>\n" (jg-site--rfc822 newest))
                ""))
      (dolist (post posts)
        (let* ((url (concat jg-site-url (alist-get 'url post)))
               (date (alist-get 'date post))
               (description (alist-get 'description post)))
          (insert "<item>\n"
                  (format "<title>%s</title>\n" (jg-site--escape (alist-get 'title post)))
                  (format "<link>%s</link>\n<guid isPermaLink=\"true\">%s</guid>\n" url url)
                  (if (string-empty-p date) ""
                    (format "<pubDate>%s</pubDate>\n" (jg-site--rfc822 date)))
                  (if (string-empty-p description) ""
                    (format "<description>%s</description>\n" (jg-site--escape description)))
                  "<content:encoded><![CDATA["
                  (string-replace "]]>" "]]]]><![CDATA[>" (jg-site--feed-body (alist-get 'url post)))
                  "]]></content:encoded>\n</item>\n")))
      (insert "</channel>\n</rss>\n"))))

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
        (insert (funcall entry (alist-get 'url piece) (alist-get 'date piece)))
        ;; A book's chapters
        (seq-doseq (chapter (alist-get 'chapters piece))
          (insert (funcall entry (alist-get 'url chapter) (alist-get 'date piece)))))
      (dolist (note notes)
        (insert (funcall entry (alist-get 'url note)
                         (format-time-string "%Y-%m-%d" (file-attribute-modification-time
                                                         (file-attributes (alist-get 'file note)))))))
      (insert "</urlset>\n"))))

(defun jg-site--clean (dir)
  "Delete the generated .html pages and .epub books in DIR (relative to the
site root), and its folders: the images and attachments copied for them
(DIR/media/), and books' chapters (DIR/BOOK/)."
  (let ((path (expand-file-name dir jg-site-root)))
    (make-directory path t)
    (dolist (file (directory-files path t "\\.\\(html\\|epub\\|pdf\\)\\'"))
      (delete-file file))
    ;; media/, and each book's folder of chapters
    (dolist (sub (directory-files path t "\\`[^.]"))
      (when (file-directory-p sub)
        (delete-directory sub t)))))

(defun jg-site-publish ()
  "Export the writing and public garden notes, and write their indexes."
  (interactive)
  (let* ((committed (jg-site--committed-files))
         ;; First, date today whatever is going online for the first time (if
         ;; git can't say what's online, change nothing)
         (new-urls (when committed
                     (jg-site--date-new-entries "animation.org" committed)
                     (jg-site--date-new-entries "comics.org" committed)
                     (append (jg-site--date-new-pages (jg-site--writing) committed)
                             (jg-site--date-new-pages (jg-site--notes) committed))))
         ;; ...then read everything, new dates included
         (writing (jg-site--writing))
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
    (jg-site--write-feed writing)
    (jg-site--write-slides writing)
    (setq jg-site-newly-published
          (mapcar (lambda (page) (assq-delete-all 'file (copy-alist page)))
                  (seq-filter (lambda (page) (member (alist-get 'url page) new-urls))
                              (append writing notes))))
    (message "Published %d piece%s of writing and %d garden note%s%s"
             (length writing) (if (= (length writing) 1) "" "s")
             (length notes) (if (= (length notes) 1) "" "s")
             (if jg-site-newly-published
                 (format " (new today: %s)"
                         (mapconcat (lambda (p) (alist-get 'title p)) jg-site-newly-published ", "))
               ""))))

(when noninteractive
  (set-language-environment "UTF-8"))

(provide 'publish)
;;; publish.el ends here
