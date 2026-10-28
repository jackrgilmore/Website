// Instagram slides for a blog post: square 1080×1080 JPEGs, made by publish.el
// (jg-site--write-slides) when it publishes. The post goes on Instagram as a
// carousel of them (the cross-posting in Emacs):
//   1.jpg       the post's picture (cropped square), or the site's card
//   2.jpg ...   the post's text in Georgia, split across as many pages as it
//               takes (at most MAX; past that, the rest is on the website)
//   last        a page about the website
// and, for Instagram's story, one phone-sized picture (1080×1920) pointing
// people to the website:
//   story.jpg
//
// Usage: slides SPEC.json, where SPEC is
//   {"title", "date", "description", "html", "cover", "card", "out", "site", "max"}
// html is the post's body (no images); cover a picture file or ""; card the
// site's og.png; out the folder for the slides (emptied first). Prints how
// many slides it made (not counting the story).

import AppKit

struct Spec: Decodable {
    let title: String
    let date: String
    let description: String
    let html: String
    let cover: String
    let card: String
    let out: String
    let site: String
    let max: Int
}

let side: CGFloat = 1080
let margin: CGFloat = 110        // left and right
let top: CGFloat = 120           // above the text
let bottom: CGFloat = 150        // below it, for the footer
let textSize: CGFloat = 34

let ink = NSColor(srgbRed: 0.12, green: 0.105, blue: 0.09, alpha: 1)
let gold = NSColor(srgbRed: 0.60, green: 0.46, blue: 0.22, alpha: 1)
let faint = NSColor(srgbRed: 0.47, green: 0.44, blue: 0.40, alpha: 1)

func georgia(_ size: CGFloat, bold: Bool = false, italic: Bool = false) -> NSFont {
    let name = bold ? (italic ? "Georgia-BoldItalic" : "Georgia-Bold") : (italic ? "Georgia-Italic" : "Georgia")
    return NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size)
}

let spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let card = NSImage(contentsOfFile: spec.card)

let paper = NSColor(srgbRed: 0.985, green: 0.975, blue: 0.959, alpha: 1)

// One slide: a bitmap SIDE wide and HEIGHT tall (square, unless it's the
// story) with the origin at the top left (y going down), filled with paper,
// then whatever DRAW draws
func slide(height: CGFloat = side, _ draw: () -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(side), pixelsHigh: Int(height),
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: side, height: height)
    let cg = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
    cg.translateBy(x: 0, y: height)
    cg.scaleBy(x: 1, y: -1)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
    // The paper: the card's own background (a corner of it, stretched), so
    // it matches the card exactly; a color picked from it comes out a shade
    // off, through color management, and shows as a band around the card
    if let card = card {
        drawImage(card, in: NSRect(x: 0, y: 0, width: side, height: height), from: NSRect(x: 2, y: 2, width: 1, height: 1))
    } else {
        paper.setFill()
        NSRect(x: 0, y: 0, width: side, height: height).fill()
    }
    draw()
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func drawImage(_ image: NSImage, in rect: NSRect, from source: NSRect = .zero) {
    image.draw(in: rect, from: source, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
}

// The post's picture, if it has one that loads
let photo: NSImage? = {
    guard !spec.cover.isEmpty, let image = NSImage(contentsOfFile: spec.cover),
          let rep = image.representations.first, rep.pixelsWide > 0 else { return nil }
    image.size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)   // its own pixels
    return image
}()

// IMAGE filling RECT, its middle cropped to RECT's shape
func drawCropped(_ image: NSImage, in rect: NSRect) {
    let w = image.size.width, h = image.size.height
    let scale = min(w / rect.width, h / rect.height)
    let cw = rect.width * scale, ch = rect.height * scale
    drawImage(image, in: rect, from: NSRect(x: (w - cw) / 2, y: (h - ch) / 2, width: cw, height: ch))
}

// TEXT drawn centered across the slide at Y, wrapped; returns its height
@discardableResult
func centered(_ text: String, _ font: NSFont, _ color: NSColor, y: CGFloat, width: CGFloat = side - 2 * margin) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.alignment = .center
    style.lineHeightMultiple = 1.15
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
    let box = (text as NSString).boundingRect(with: NSSize(width: width, height: .greatestFiniteMagnitude),
                                              options: [.usesLineFragmentOrigin], attributes: attrs)
    (text as NSString).draw(with: NSRect(x: (side - width) / 2, y: y, width: width, height: ceil(box.height)),
                            options: [.usesLineFragmentOrigin], attributes: attrs)
    return ceil(box.height)
}

// ---- The text, from the post's HTML, in Georgia ----

let css = """
<style>
body { font-family: Georgia; font-size: \(textSize)px; line-height: 1.5; color: #1f1b16; }
p { margin: 0 0 0.75em; }
a { color: #1f1b16; text-decoration: none; }
h1, h2, h3, h4 { font-size: 1.12em; font-weight: bold; margin: 0.4em 0 0.5em; }
blockquote { font-style: italic; margin: 0 0 0.75em 1.2em; }
ul, ol { margin: 0 0 0.75em; }
li { margin: 0 0 0.3em; }
code { font-family: Georgia; }
</style>
"""
let body = try NSMutableAttributedString(
    data: (css + spec.html).data(using: .utf8)!,
    options: [.documentType: NSAttributedString.DocumentType.html,
              .characterEncoding: String.Encoding.utf8.rawValue],
    documentAttributes: nil)
// Links in the text color (an image can't be clicked), roomier lines than
// the HTML reader gives (it ignores line-height), and no blank lines at the end
let all = NSRange(location: 0, length: body.length)
body.removeAttribute(.link, range: all)
body.addAttribute(.foregroundColor, value: ink, range: all)
body.enumerateAttribute(.paragraphStyle, in: all) { value, range, _ in
    let style = ((value as? NSParagraphStyle) ?? NSParagraphStyle.default).mutableCopy() as! NSMutableParagraphStyle
    style.lineHeightMultiple = 1.22
    body.addAttribute(.paragraphStyle, value: style, range: range)
}
while body.length > 0, let last = body.string.unicodeScalars.last, CharacterSet.whitespacesAndNewlines.contains(last) {
    body.deleteCharacters(in: NSRange(location: body.length - 1, length: 1))
}

// Numbered lists: the HTML reader writes their numbers bare, and a tab after
// them that a two-digit number overruns ("1\tText"), so make it "1. Text"
let numbers = try NSRegularExpression(pattern: "^\\t(\\d+)\\t", options: .anchorsMatchLines)
for match in numbers.matches(in: body.string, range: NSRange(location: 0, length: body.length)).reversed() {
    body.replaceCharacters(in: NSRange(location: NSMaxRange(match.range(at: 1)), length: 1), with: ". ")
}

// The first text slide starts with the title, the date and a short rule: how
// much room that takes, measured with the same fonts it's drawn with
let titleFont = georgia(54, bold: true)
let dateFont = georgia(26, italic: true)
func measure(_ text: String, _ font: NSFont, width: CGFloat = side - 2 * margin) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.lineHeightMultiple = 1.15
    return ceil((text as NSString).boundingRect(
        with: NSSize(width: width, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin], attributes: [.font: font, .paragraphStyle: style]).height)
}
let titleHeight = measure(spec.title, titleFont)
let dateHeight = spec.date.isEmpty ? 0 : measure(spec.date, dateFont)
let firstTop = top + titleHeight + (spec.date.isEmpty ? 0 : 18 + dateHeight) + 34 + 2 + 52

// Split the text into pages: a text container per slide, as many as it takes
let storage = NSTextStorage(attributedString: body)
let layout = NSLayoutManager()
storage.addLayoutManager(layout)
var pages: [(NSTextContainer, CGFloat)] = []     // each with the y its text starts at
while true {
    let y = pages.isEmpty ? firstTop : top
    let container = NSTextContainer(size: NSSize(width: side - 2 * margin, height: side - y - bottom))
    container.lineFragmentPadding = 0
    layout.addTextContainer(container)
    pages.append((container, y))
    if NSMaxRange(layout.glyphRange(for: container)) >= layout.numberOfGlyphs || pages.count >= 60 { break }
}
let cut = pages.count > spec.max            // too long: the rest is on the website
if cut { pages = Array(pages.prefix(spec.max)) }

// ---- Draw the slides ----

var slides: [NSBitmapImageRep] = []

// 1: the post's picture, cropped square; or the card, on its own paper
slides.append(slide {
    if let photo = photo {
        drawCropped(photo, in: NSRect(x: 0, y: 0, width: side, height: side))
    } else if let card = card {
        let h = side * card.size.height / card.size.width
        drawImage(card, in: NSRect(x: 0, y: (side - h) / 2, width: side, height: h))
    }
})

// The text
for (i, page) in pages.enumerated() {
    slides.append(slide {
        if i == 0 {
            var y = top
            y += centered(spec.title, titleFont, ink, y: y)
            if !spec.date.isEmpty {
                y += 18
                y += centered(spec.date, dateFont, gold, y: y)
            }
            gold.setFill()
            NSRect(x: (side - 90) / 2, y: y + 34, width: 90, height: 2).fill()
        }
        let range = layout.glyphRange(for: page.0)
        layout.drawBackground(forGlyphRange: range, at: NSPoint(x: margin, y: page.1))
        layout.drawGlyphs(forGlyphRange: range, at: NSPoint(x: margin, y: page.1))

        // Footer: the site, and where you are in the post
        let foot = side - 92
        (spec.site as NSString).draw(at: NSPoint(x: margin, y: foot),
                                     withAttributes: [.font: georgia(22, italic: true), .foregroundColor: gold])
        let more = (i == pages.count - 1 && cut) ? "continued on the website" : "\(i + 1) / \(pages.count)"
        let attrs: [NSAttributedString.Key: Any] = [.font: georgia(22, italic: true), .foregroundColor: faint]
        let width = (more as NSString).size(withAttributes: attrs).width
        (more as NSString).draw(at: NSPoint(x: side - margin - width, y: foot), withAttributes: attrs)
    })
}

// Last: the website. The card, then where to find the rest
slides.append(slide {
    var y: CGFloat = 150
    if let card = card {
        let h = side * card.size.height / card.size.width
        drawImage(card, in: NSRect(x: 0, y: y, width: side, height: h))
        y += h + 30
    }
    y += centered(cut ? "Read the rest of “\(spec.title)” at \(spec.site)"
                      : "More writing, comics and animation at \(spec.site)",
                  georgia(34), ink, y: y, width: side - 2 * 140)
    centered("Link in bio", georgia(28, italic: true), gold, y: y + 26)
})

// ---- The story ----
// Phone-sized. Instagram's own buttons cover its top and bottom, so it's all
// in a block in the middle: what it is, the picture, the title and its
// description, and a button-like pill pointing to the website

let tall: CGFloat = 1920
let inner: CGFloat = 860                    // the width things are set in
var blurb = spec.description
if blurb.count > 170 {                      // a sentence or two, not a paragraph
    blurb = String(blurb.prefix(170)).replacingOccurrences(of: "\\s+\\S*$", with: "", options: .regularExpression) + "…"
}
let kickerFont = georgia(40, italic: true)
let storyTitleFont = georgia(68, bold: true)
let blurbFont = georgia(34, italic: true)
let pillFont = georgia(40)
let pillText = "Read it on my website  →"
let footText = "\(spec.site) · link in bio"
let picture: CGFloat = photo != nil ? inner : (card.map { side * $0.size.height / $0.size.width } ?? 0)
let blocks: [CGFloat] = [measure("New on the blog", kickerFont, width: inner), 44, picture, 64,
                         measure(spec.title, storyTitleFont, width: inner),
                         blurb.isEmpty ? 0 : 24 + measure(blurb, blurbFont, width: inner - 40),
                         76, 116, 36, measure(footText, georgia(30, italic: true), width: inner)]
let story = slide(height: tall) {
    var y = max(260, (tall - blocks.reduce(0, +)) / 2 - 30)
    y += centered("New on the blog", kickerFont, gold, y: y, width: inner) + 44
    if let photo = photo {
        let frame = NSRect(x: (side - inner) / 2, y: y, width: inner, height: inner)
        NSGraphicsContext.saveGraphicsState()
        NSBezierPath(roundedRect: frame, xRadius: 28, yRadius: 28).addClip()
        drawCropped(photo, in: frame)
        NSGraphicsContext.restoreGraphicsState()
    } else if let card = card {
        drawImage(card, in: NSRect(x: 0, y: y, width: side, height: picture))
    }
    y += picture + 64
    y += centered(spec.title, storyTitleFont, ink, y: y, width: inner)
    if !blurb.isEmpty {
        y += 24 + centered(blurb, blurbFont, faint, y: y + 24, width: inner - 40)
    }
    y += 76
    // The pill: gold, the width of its words plus room either side
    let attrs: [NSAttributedString.Key: Any] = [.font: pillFont, .foregroundColor: paper]
    let words = (pillText as NSString).size(withAttributes: attrs)
    let pill = NSRect(x: (side - words.width - 128) / 2, y: y, width: words.width + 128, height: 116)
    gold.setFill()
    NSBezierPath(roundedRect: pill, xRadius: 58, yRadius: 58).fill()
    (pillText as NSString).draw(at: NSPoint(x: pill.minX + 64, y: pill.midY - words.height / 2), withAttributes: attrs)
    y += 116 + 36
    centered(footText, georgia(30, italic: true), gold, y: y, width: inner)
}

// ---- Save them ----

let out = URL(fileURLWithPath: spec.out)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
for file in try FileManager.default.contentsOfDirectory(atPath: spec.out) where file.hasSuffix(".jpg") {
    try FileManager.default.removeItem(at: out.appendingPathComponent(file))
}
for (n, rep) in slides.enumerated() {
    try rep.representation(using: .jpeg, properties: [.compressionFactor: 0.9])!
        .write(to: out.appendingPathComponent("\(n + 1).jpg"))
}
try story.representation(using: .jpeg, properties: [.compressionFactor: 0.9])!
    .write(to: out.appendingPathComponent("story.jpg"))
print(slides.count)
