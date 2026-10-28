// Instagram pictures for a blog post, made by publish.el (jg-site--write-slides)
// when it publishes, and posted by the cross-posting in Emacs:
//   1.jpg ...   square (1080×1080) slides for a carousel: the post's text in
//               Georgia, split across as many as it takes (at most MAX; past
//               that, the rest is on the website), then a slide about the
//               website (the site's card in dark colors, design/card-dark.png)
//   story.jpg   phone-sized (1080×1920), for the story: design/story.png (a
//               background you can make in Photoshop or Inkscape) with the
//               post's picture, title and description where design/story.json
//               says
//
// Usage:
//   slides SPEC.json           draw a post's pictures. SPEC is
//                              {"title", "date", "description", "html", "cover",
//                               "card", "hat", "design", "out", "site", "max"}:
//                              html the post's body (no images), cover its
//                              picture file or "", card the site's dark card,
//                              hat Hat Guy alone (design/hat-guy.png) or "",
//                              design the design/ folder, out the folder for
//                              the pictures (emptied first). Prints how many
//                              slides it made (not counting the story).
//   slides --starter DESIGN CARD   write the starting story design into the
//                              folder DESIGN: story.png, story.json and the
//                              guide (overwriting them)
//   slides --guide DESIGN      redraw DESIGN/story-guide.png from story.json

import AppKit

let side: CGFloat = 1080
let tall: CGFloat = 1920                     // the story
let margin: CGFloat = 110                    // left and right
let top: CGFloat = 120                       // above the text
let bottom: CGFloat = 160                    // below it, for the footer
let textSize: CGFloat = 34
let footSize: CGFloat = 30                   // the site at the bottom
let pageSize: CGFloat = 44                   // the page numbers beside it, bigger to read

// The website's dark theme (site.css): headings, text, accent, muted, background
let ink = NSColor(srgbRed: 0.91, green: 0.878, blue: 0.831, alpha: 1)      // #e8e0d4
let prose = NSColor(srgbRed: 0.831, green: 0.804, blue: 0.769, alpha: 1)    // #d4cdc4
let gold = NSColor(srgbRed: 0.788, green: 0.663, blue: 0.431, alpha: 1)    // #c9a96e
let faint = NSColor(srgbRed: 0.561, green: 0.533, blue: 0.498, alpha: 1)   // #8f887f
let paper = NSColor(srgbRed: 0.067, green: 0.067, blue: 0.067, alpha: 1)   // #111111

func georgia(_ size: CGFloat, bold: Bool = false, italic: Bool = false) -> NSFont {
    let name = bold ? (italic ? "Georgia-BoldItalic" : "Georgia-Bold") : (italic ? "Georgia-Italic" : "Georgia")
    return NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size)
}

var card: NSImage?                           // the site's dark card (design/card-dark.png)

// A bitmap SIDE wide and HEIGHT tall with the origin at the top left (y going
// down), filled with paper (unless CLEAR), then whatever DRAW draws
func slide(height: CGFloat = side, clear: Bool = false, _ draw: () -> Void) -> NSBitmapImageRep {
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
    if clear {
    } else if let card = card {
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

func measure(_ text: String, _ font: NSFont, width: CGFloat = side - 2 * margin) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.lineHeightMultiple = 1.15
    return ceil((text as NSString).boundingRect(
        with: NSSize(width: width, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin], attributes: [.font: font, .paragraphStyle: style]).height)
}

func save(_ rep: NSBitmapImageRep, _ path: String, png: Bool = false) throws {
    try rep.representation(using: png ? .png : .jpeg, properties: png ? [:] : [.compressionFactor: 0.9])!
        .write(to: URL(fileURLWithPath: path))
}


// ============ THE STORY'S DESIGN ============
// story.json: a box (in pixels, from the top left of the 1080×1920 story) for
// each of the post's picture, title and description, and how its text looks.
// Anything left out is as in the starter.

struct Box: Codable {
    var x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat
    var size: CGFloat? = nil         // text: the biggest it's set (smaller if it won't fit)
    var font: String? = nil          // text: a font's PostScript name (Font Book shows it)
    var color: String? = nil         // text: "#1f1b16"
    var align: String? = nil         // text: "left", "center" or "right"
    var radius: CGFloat? = nil       // the picture: its corners' rounding
    var rect: NSRect { NSRect(x: x, y: y, width: width, height: height) }
}

struct StoryLayout: Codable {
    var picture = Box(x: 150, y: 370, width: 780, height: 780, radius: 20)
    var title = Box(x: 110, y: 1170, width: 860, height: 160,
                    size: 64, font: "Georgia-Bold", color: "#e8e0d4", align: "center")
    var description = Box(x: 150, y: 1335, width: 780, height: 84,
                          size: 34, font: "Georgia-Italic", color: "#8f887f", align: "center")
}

func storyLayout(_ design: String) -> StoryLayout {
    guard let data = FileManager.default.contents(atPath: design + "/story.json") else { return StoryLayout() }
    do {
        return try JSONDecoder().decode(StoryLayout.self, from: data)
    } catch {
        FileHandle.standardError.write("design/story.json: \(error); using the starter's layout\n".data(using: .utf8)!)
        return StoryLayout()
    }
}

func color(_ hex: String?, _ fallback: NSColor) -> NSColor {
    guard let hex = hex?.trimmingCharacters(in: CharacterSet(charactersIn: "# ")), hex.count == 6,
          let n = UInt32(hex, radix: 16) else { return fallback }
    return NSColor(srgbRed: CGFloat(n >> 16 & 255) / 255, green: CGFloat(n >> 8 & 255) / 255,
                   blue: CGFloat(n & 255) / 255, alpha: 1)
}

// TEXT set in BOX: as big as BOX.size, smaller (down to 60%) if that won't
// fit, then cut short with "…"; centered up and down in the box
func fit(_ text: String, in box: Box) {
    guard !text.isEmpty else { return }
    let style = NSMutableParagraphStyle()
    style.alignment = box.align == "left" ? .left : box.align == "right" ? .right : .center
    style.lineHeightMultiple = 1.12
    let biggest = box.size ?? 40
    func attrs(_ size: CGFloat) -> [NSAttributedString.Key: Any] {
        [.font: NSFont(name: box.font ?? "Georgia", size: size) ?? georgia(size),
         .foregroundColor: color(box.color, ink), .paragraphStyle: style]
    }
    func height(_ s: String, _ size: CGFloat) -> CGFloat {
        ceil((s as NSString).boundingRect(with: NSSize(width: box.width, height: .greatestFiniteMagnitude),
                                          options: [.usesLineFragmentOrigin], attributes: attrs(size)).height)
    }
    var size = biggest
    while size > biggest * 0.6 && height(text, size) > box.height { size -= 2 }
    var words = text.split(separator: " ").map(String.init)
    var shown = text
    while words.count > 1 && height(shown, size) > box.height {
        words.removeLast()
        shown = words.joined(separator: " ") + "…"
    }
    let h = min(height(shown, size), box.height)
    (shown as NSString).draw(with: NSRect(x: box.x, y: box.y + (box.height - h) / 2, width: box.width, height: h),
                             options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attrs(size))
}

// The starter background, kept plain: the dark paper, "New on the blog"
// above the picture, and the website, small, at the bottom
func starterBackground(site: String) -> NSBitmapImageRep {
    slide(height: tall) {
        centered("New on the blog", georgia(36, italic: true), gold, y: 280, width: 860)
        centered(site, georgia(32, italic: true), faint, y: 1625, width: 860)
    }
}

// The guide: a see-through layer to lay over story.png while designing it.
// The boxes the post fills in, and the strips Instagram covers with its own
// buttons (keep anything important out of those)
func guide(_ layout: StoryLayout) -> NSBitmapImageRep {
    slide(height: tall, clear: true) {
        let covered = NSColor(srgbRed: 0.85, green: 0.2, blue: 0.2, alpha: 0.18)
        covered.setFill()
        NSRect(x: 0, y: 0, width: side, height: 250).fill()
        NSRect(x: 0, y: tall - 250, width: side, height: 250).fill()
        let note: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 30, weight: .medium),
                                                   .foregroundColor: NSColor(srgbRed: 0.7, green: 0.1, blue: 0.1, alpha: 0.9)]
        ("Instagram's buttons cover this" as NSString).draw(at: NSPoint(x: 40, y: 190), withAttributes: note)
        ("Instagram's buttons cover this" as NSString).draw(at: NSPoint(x: 40, y: tall - 230), withAttributes: note)
        for (name, box, tint) in [("picture", layout.picture, NSColor.systemBlue),
                                  ("title", layout.title, NSColor.systemGreen),
                                  ("description", layout.description, NSColor.systemPurple)] {
            tint.withAlphaComponent(0.16).setFill()
            box.rect.fill()
            tint.withAlphaComponent(0.85).setStroke()
            let outline = NSBezierPath(rect: box.rect.insetBy(dx: 1.5, dy: 1.5))
            outline.lineWidth = 3
            outline.setLineDash([14, 8], count: 2, phase: 0)
            outline.stroke()
            ("\(name)  \(Int(box.x)), \(Int(box.y))  \(Int(box.width))×\(Int(box.height))" as NSString)
                .draw(at: NSPoint(x: box.x + 12, y: box.y + 8),
                      withAttributes: [.font: NSFont.systemFont(ofSize: 26, weight: .semibold),
                                       .foregroundColor: tint.withAlphaComponent(0.95)])
        }
    }
}

let args = CommandLine.arguments
if args.count > 2 && args[1] == "--starter" {
    let design = args[2]
    card = args.count > 3 ? NSImage(contentsOfFile: args[3]) : nil
    try FileManager.default.createDirectory(atPath: design, withIntermediateDirectories: true)
    try save(starterBackground(site: "jackgilmorecreative.com"), design + "/story.png", png: true)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(StoryLayout()).write(to: URL(fileURLWithPath: design + "/story.json"))
    try save(guide(StoryLayout()), design + "/story-guide.png", png: true)
    exit(0)
}
if args.count > 2 && args[1] == "--guide" {
    try save(guide(storyLayout(args[2])), args[2] + "/story-guide.png", png: true)
    exit(0)
}


// ============ A POST ============

struct Spec: Decodable {
    let title: String
    let date: String
    let description: String
    let html: String
    let cover: String
    let card: String
    let hat: String
    let design: String
    let out: String
    let site: String
    let max: Int
}

let spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
card = NSImage(contentsOfFile: spec.card)

// The post's picture, if it has one that loads
let photo: NSImage? = {
    guard !spec.cover.isEmpty, let image = NSImage(contentsOfFile: spec.cover),
          let rep = image.representations.first, rep.pixelsWide > 0 else { return nil }
    image.size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)   // its own pixels
    return image
}()

// ---- The text, from the post's HTML, in Georgia ----

let css = """
<style>
body { font-family: Georgia; font-size: \(textSize)px; line-height: 1.5; color: #d4cdc4; }
p { margin: 0 0 0.75em; }
a { color: #d4cdc4; text-decoration: none; }
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
body.addAttribute(.foregroundColor, value: prose, range: all)
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

// The first slide starts with the title, the date and a short rule: how much
// room that takes, measured with the same fonts it's drawn with
let titleFont = georgia(54, bold: true)
let dateFont = georgia(26, italic: true)
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

// ---- The carousel: the text, then the website ----

var slides: [NSBitmapImageRep] = []

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
        let foot = side - 108
        (spec.site as NSString).draw(at: NSPoint(x: margin, y: foot),
                                     withAttributes: [.font: georgia(footSize, italic: true), .foregroundColor: gold])
        // On the same baseline as the site, though bigger
        let last = i == pages.count - 1 && cut
        let more = last ? "continued on the website" : "\(i + 1) / \(pages.count)"
        let font = georgia(last ? footSize : pageSize, italic: true)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: faint]
        let width = (more as NSString).size(withAttributes: attrs).width
        let baseline = foot + georgia(footSize, italic: true).ascender
        (more as NSString).draw(at: NSPoint(x: side - margin - width, y: baseline - font.ascender), withAttributes: attrs)
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
                  georgia(34), prose, y: y, width: side - 2 * 140)
    centered("Link in bio", georgia(28, italic: true), gold, y: y + 26)
})

// ---- The story: the design's background, then the post in its boxes ----

let boxes = storyLayout(spec.design)
let background = NSImage(contentsOfFile: spec.design + "/story.png")
let story = slide(height: tall) {
    if let background = background {
        drawCropped(background, in: NSRect(x: 0, y: 0, width: side, height: tall))
    }
    // The picture, cropped to its box; with none, Hat Guy (as favicon.svg
    // draws him, sticker border and all), smaller, in the middle of it
    let frame = boxes.picture.rect
    if let photo = photo {
        NSGraphicsContext.saveGraphicsState()
        let r = boxes.picture.radius ?? 0
        NSBezierPath(roundedRect: frame, xRadius: r, yRadius: r).addClip()
        drawCropped(photo, in: frame)
        NSGraphicsContext.restoreGraphicsState()
    } else if let hat = NSImage(contentsOfFile: spec.hat) {
        let s = min(frame.width, frame.height) * 0.6
        drawImage(hat, in: NSRect(x: frame.midX - s / 2, y: frame.midY - s / 2, width: s, height: s))
    }
    fit(spec.title, in: boxes.title)
    fit(spec.description, in: boxes.description)
}

// ---- Save them ----

let out = URL(fileURLWithPath: spec.out)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
for file in try FileManager.default.contentsOfDirectory(atPath: spec.out) where file.hasSuffix(".jpg") {
    try FileManager.default.removeItem(at: out.appendingPathComponent(file))
}
for (n, rep) in slides.enumerated() {
    try save(rep, out.appendingPathComponent("\(n + 1).jpg").path)
}
try save(story, out.appendingPathComponent("story.jpg").path)
print(slides.count)
