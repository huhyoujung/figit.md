// Figma Plugin Main Code (Sandbox)
figma.showUI(__html__, {
  width: 500,
  height: 600,
  title: "Figit - GitHub Markdown Viewer"
});

// Font configurations - will be set dynamically based on available fonts
var FONTS = {
  regular: { family: "Inter", style: "Regular" } as FontName,
  bold: { family: "Inter", style: "Bold" } as FontName,
  italic: { family: "Inter", style: "Italic" } as FontName,
  boldItalic: { family: "Inter", style: "Bold Italic" } as FontName,
  mono: { family: "Roboto Mono", style: "Regular" } as FontName,
  monoBold: { family: "Roboto Mono", style: "Bold" } as FontName,
};

// Preferred font families in order
var PREFERRED_FONTS = [
  { family: "SF Pro Text", regular: "Regular", bold: "Bold", italic: "Regular Italic", boldItalic: "Bold Italic" },
  { family: "SF Pro", regular: "Regular", bold: "Bold", italic: "Regular Italic", boldItalic: "Bold Italic" },
  { family: ".SF NS", regular: "Regular", bold: "Bold", italic: "Regular Italic", boldItalic: "Bold Italic" },
  { family: "Helvetica Neue", regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "Bold Italic" },
  { family: "Inter", regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "Bold Italic" },
];

var PREFERRED_MONO_FONTS = [
  { family: "SF Mono", regular: "Regular", bold: "Bold" },
  { family: "Menlo", regular: "Regular", bold: "Bold" },
  { family: "Monaco", regular: "Regular", bold: "Bold" },
  { family: "Roboto Mono", regular: "Regular", bold: "Bold" },
];

async function initializeFonts() {
  var availableFonts = await figma.listAvailableFontsAsync();
  var fontFamilies = new Set<string>();
  for (var i = 0; i < availableFonts.length; i++) {
    fontFamilies.add(availableFonts[i].fontName.family);
  }

  // Find best available text font
  for (var i = 0; i < PREFERRED_FONTS.length; i++) {
    var pref = PREFERRED_FONTS[i];
    if (fontFamilies.has(pref.family)) {
      FONTS.regular = { family: pref.family, style: pref.regular };
      FONTS.bold = { family: pref.family, style: pref.bold };
      FONTS.italic = { family: pref.family, style: pref.italic };
      FONTS.boldItalic = { family: pref.family, style: pref.boldItalic };
      console.log("Using font family:", pref.family);
      break;
    }
  }

  // Find best available mono font
  for (var i = 0; i < PREFERRED_MONO_FONTS.length; i++) {
    var pref = PREFERRED_MONO_FONTS[i];
    if (fontFamilies.has(pref.family)) {
      FONTS.mono = { family: pref.family, style: pref.regular };
      FONTS.monoBold = { family: pref.family, style: pref.bold };
      console.log("Using mono font family:", pref.family);
      break;
    }
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg: { type: string; [key: string]: any }) => {
  switch (msg.type) {
    case 'notify':
      figma.notify(msg.message, {
        timeout: msg.timeout || 2000,
        error: msg.error || false
      });
      break;

    case 'close':
      figma.closePlugin();
      break;

    case 'save-settings':
      await figma.clientStorage.setAsync('figit-settings', msg.settings);
      break;

    case 'load-settings':
      const settings = await figma.clientStorage.getAsync('figit-settings');
      figma.ui.postMessage({ type: 'settings-loaded', settings });
      break;

    case 'insert-markdown':
      try {
        await insertMarkdownToCanvas(msg.html, msg.fileName, msg.repoInfo, msg.pageWidth || 520);
      } catch (err: any) {
        console.error('Insert error:', err);
        figma.notify('Error: ' + (err.message || 'Failed to insert'), { error: true });
      }
      break;
  }
};

// Inline segment for rich text
interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: string | null;
}

// Block types
type BlockType = 'paragraph' | 'header' | 'codeBlock' | 'blockquote' | 'listItem' | 'hr';

interface Block {
  type: BlockType;
  level?: number; // for headers
  segments: InlineSegment[];
  rawText?: string; // for code blocks
}

async function insertMarkdownToCanvas(html: string, fileName: string, repoInfo: string, pageWidth: number = 520) {
  // Initialize fonts based on available system fonts
  await initializeFonts();

  // Load all required fonts
  await Promise.all([
    figma.loadFontAsync(FONTS.regular),
    figma.loadFontAsync(FONTS.bold),
    figma.loadFontAsync(FONTS.italic),
    figma.loadFontAsync(FONTS.boldItalic),
    figma.loadFontAsync(FONTS.mono),
    figma.loadFontAsync(FONTS.monoBold),
  ]);

  // Parse HTML to blocks
  const blocks = parseHtmlToBlocks(html);

  // Calculate content width based on page width and padding
  const horizontalPadding = 56; // 28px left + 28px right
  const contentWidth = pageWidth - horizontalPadding;

  // Create main frame with auto-layout
  const frame = figma.createFrame();
  frame.name = "📄 " + fileName + " - Figit";
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.cornerRadius = 12;
  frame.clipsContent = true;
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(pageWidth, 100);
  frame.paddingTop = 24;
  frame.paddingBottom = 24;
  frame.paddingLeft = 28;
  frame.paddingRight = 28;
  frame.itemSpacing = 16;

  // Position next to viewport
  const viewport = figma.viewport.center;
  frame.x = viewport.x + 100;
  frame.y = viewport.y - 250;

  // Header section
  const headerFrame = figma.createFrame();
  headerFrame.name = "Header";
  headerFrame.layoutMode = 'VERTICAL';
  headerFrame.primaryAxisSizingMode = 'AUTO';
  headerFrame.counterAxisSizingMode = 'AUTO';
  headerFrame.fills = [];
  headerFrame.itemSpacing = 4;

  // Title text
  const titleText = figma.createText();
  titleText.fontName = FONTS.bold;
  titleText.characters = fileName;
  titleText.fontSize = 18;
  titleText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  titleText.lineHeight = { value: 140, unit: 'PERCENT' };
  headerFrame.appendChild(titleText);

  // Repo text
  const repoText = figma.createText();
  repoText.fontName = FONTS.regular;
  repoText.characters = repoInfo;
  repoText.fontSize = 12;
  repoText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
  repoText.lineHeight = { value: 150, unit: 'PERCENT' };
  headerFrame.appendChild(repoText);

  frame.appendChild(headerFrame);

  // Divider
  const divider = figma.createRectangle();
  divider.name = "Divider";
  divider.resize(contentWidth, 1);
  divider.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
  divider.layoutAlign = 'STRETCH';
  frame.appendChild(divider);

  // Content frame
  const contentFrame = figma.createFrame();
  contentFrame.name = "Content";
  contentFrame.layoutMode = 'VERTICAL';
  contentFrame.primaryAxisSizingMode = 'AUTO';
  contentFrame.counterAxisSizingMode = 'AUTO';
  contentFrame.fills = [];
  contentFrame.itemSpacing = 14;
  contentFrame.layoutAlign = 'STRETCH';

  // Create content
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    await renderBlock(contentFrame, block, contentWidth);
  }

  frame.appendChild(contentFrame);

  // Select and scroll to frame
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  figma.notify('Markdown inserted to canvas!');
}

function parseHtmlToBlocks(html: string): Block[] {
  var blocks: Block[] = [];

  if (!html) {
    blocks.push({ type: 'paragraph', segments: [{ text: 'No content', bold: false, italic: false, code: false, link: null }] });
    return blocks;
  }

  // Normalize
  html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Process different block elements
  var tempDiv = html;

  // Extract headers
  var headerRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  var match;
  var lastIndex = 0;
  var parts: Array<{ type: string; content: string; level?: number; start: number; end: number }> = [];

  // Find all block elements with their positions
  var blockPatterns = [
    { regex: /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, type: 'header' },
    { regex: /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, type: 'codeBlock' },
    { regex: /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, type: 'blockquote' },
    { regex: /<ul[^>]*>([\s\S]*?)<\/ul>/gi, type: 'ul' },
    { regex: /<ol[^>]*>([\s\S]*?)<\/ol>/gi, type: 'ol' },
    { regex: /<p[^>]*>([\s\S]*?)<\/p>/gi, type: 'paragraph' },
    { regex: /<hr[^>]*\/?>/gi, type: 'hr' },
  ];

  var allMatches: Array<{ type: string; match: RegExpExecArray; level?: number }> = [];

  for (var p = 0; p < blockPatterns.length; p++) {
    var pattern = blockPatterns[p];
    var regex = new RegExp(pattern.regex.source, 'gi');
    var m;
    while ((m = regex.exec(html)) !== null) {
      var entry: { type: string; match: RegExpExecArray; level?: number } = { type: pattern.type, match: m };
      if (pattern.type === 'header' && m[1]) {
        entry.level = parseInt(m[1]);
      }
      allMatches.push(entry);
    }
  }

  // Sort by position
  allMatches.sort(function(a, b) { return a.match.index - b.match.index; });

  // Process matches
  for (var i = 0; i < allMatches.length; i++) {
    var item = allMatches[i];
    var m = item.match;

    if (item.type === 'header') {
      var headerContent = m[2];
      var segs = parseInlineContent(headerContent);
      if (segs.length > 0) {
        blocks.push({ type: 'header', level: item.level, segments: segs });
      }
    } else if (item.type === 'codeBlock') {
      var codeContent = decodeHtmlEntities(m[1]);
      blocks.push({ type: 'codeBlock', segments: [], rawText: codeContent });
    } else if (item.type === 'blockquote') {
      var quoteContent = m[1];
      var segs = parseInlineContent(quoteContent);
      if (segs.length > 0) {
        blocks.push({ type: 'blockquote', segments: segs });
      }
    } else if (item.type === 'ul' || item.type === 'ol') {
      var listContent = m[1];
      var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      var liMatch;
      while ((liMatch = liRegex.exec(listContent)) !== null) {
        var liSegs = parseInlineContent(liMatch[1]);
        if (liSegs.length > 0) {
          blocks.push({ type: 'listItem', segments: liSegs });
        }
      }
    } else if (item.type === 'paragraph') {
      var pContent = m[1];
      var segs = parseInlineContent(pContent);
      if (segs.length > 0) {
        blocks.push({ type: 'paragraph', segments: segs });
      }
    } else if (item.type === 'hr') {
      blocks.push({ type: 'hr', segments: [] });
    }
  }

  if (blocks.length === 0) {
    var plainText = stripAllHtml(html);
    if (plainText.trim()) {
      blocks.push({ type: 'paragraph', segments: [{ text: plainText, bold: false, italic: false, code: false, link: null }] });
    }
  }

  return blocks;
}

function parseInlineContent(html: string): InlineSegment[] {
  var segments: InlineSegment[] = [];

  if (!html || !html.trim()) return segments;

  // Tokenize inline elements
  // We'll walk through the HTML and extract text with formatting
  var result = extractInlineSegments(html);

  return result;
}

function extractInlineSegments(html: string): InlineSegment[] {
  var segments: InlineSegment[] = [];

  // Simple state-based parser
  var pos = 0;
  var len = html.length;

  while (pos < len) {
    // Check for tags
    if (html[pos] === '<') {
      var tagEnd = html.indexOf('>', pos);
      if (tagEnd === -1) {
        // Malformed, treat rest as text
        var rest = html.substring(pos);
        if (rest.trim()) {
          segments.push({ text: decodeHtmlEntities(rest), bold: false, italic: false, code: false, link: null });
        }
        break;
      }

      var tag = html.substring(pos, tagEnd + 1);
      var tagLower = tag.toLowerCase();

      // Check for specific tags
      if (tagLower.indexOf('<strong') === 0 || tagLower.indexOf('<b>') === 0 || tagLower.indexOf('<b ') === 0) {
        var closeTag = tagLower.indexOf('<strong') === 0 ? '</strong>' : '</b>';
        var closeIdx = html.toLowerCase().indexOf(closeTag, tagEnd);
        if (closeIdx !== -1) {
          var inner = html.substring(tagEnd + 1, closeIdx);
          var innerSegs = extractInlineSegments(inner);
          for (var i = 0; i < innerSegs.length; i++) {
            innerSegs[i].bold = true;
            segments.push(innerSegs[i]);
          }
          pos = closeIdx + closeTag.length;
          continue;
        }
      } else if (tagLower.indexOf('<em') === 0 || tagLower.indexOf('<i>') === 0 || tagLower.indexOf('<i ') === 0) {
        var closeTag = tagLower.indexOf('<em') === 0 ? '</em>' : '</i>';
        var closeIdx = html.toLowerCase().indexOf(closeTag, tagEnd);
        if (closeIdx !== -1) {
          var inner = html.substring(tagEnd + 1, closeIdx);
          var innerSegs = extractInlineSegments(inner);
          for (var i = 0; i < innerSegs.length; i++) {
            innerSegs[i].italic = true;
            segments.push(innerSegs[i]);
          }
          pos = closeIdx + closeTag.length;
          continue;
        }
      } else if (tagLower.indexOf('<code') === 0) {
        var closeIdx = html.toLowerCase().indexOf('</code>', tagEnd);
        if (closeIdx !== -1) {
          var inner = html.substring(tagEnd + 1, closeIdx);
          var text = decodeHtmlEntities(stripAllHtml(inner));
          if (text) {
            segments.push({ text: text, bold: false, italic: false, code: true, link: null });
          }
          pos = closeIdx + 7;
          continue;
        }
      } else if (tagLower.indexOf('<a ') === 0 || tagLower.indexOf('<a>') === 0) {
        var closeIdx = html.toLowerCase().indexOf('</a>', tagEnd);
        if (closeIdx !== -1) {
          var hrefMatch = tag.match(/href=["']([^"']*)["']/i);
          var href = hrefMatch ? hrefMatch[1] : '';
          var inner = html.substring(tagEnd + 1, closeIdx);
          var text = decodeHtmlEntities(stripAllHtml(inner));
          if (text) {
            segments.push({ text: text, bold: false, italic: false, code: false, link: href });
          }
          pos = closeIdx + 4;
          continue;
        }
      } else if (tagLower.indexOf('<br') === 0) {
        segments.push({ text: '\n', bold: false, italic: false, code: false, link: null });
        pos = tagEnd + 1;
        continue;
      }

      // Skip other tags
      pos = tagEnd + 1;
    } else {
      // Regular text until next tag
      var nextTag = html.indexOf('<', pos);
      if (nextTag === -1) nextTag = len;
      var text = html.substring(pos, nextTag);
      text = decodeHtmlEntities(text);
      if (text) {
        segments.push({ text: text, bold: false, italic: false, code: false, link: null });
      }
      pos = nextTag;
    }
  }

  // Merge adjacent segments with same formatting
  var merged: InlineSegment[] = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (merged.length > 0) {
      var last = merged[merged.length - 1];
      if (last.bold === seg.bold && last.italic === seg.italic && last.code === seg.code && last.link === seg.link) {
        last.text += seg.text;
        continue;
      }
    }
    merged.push(seg);
  }

  return merged;
}

function stripAllHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, function(match, dec) {
      return String.fromCharCode(parseInt(dec));
    });
}

async function renderBlock(container: FrameNode, block: Block, contentWidth: number) {
  if (block.type === 'header') {
    await renderHeader(container, block, contentWidth);
  } else if (block.type === 'codeBlock') {
    await renderCodeBlock(container, block, contentWidth);
  } else if (block.type === 'blockquote') {
    await renderBlockquote(container, block, contentWidth);
  } else if (block.type === 'listItem') {
    await renderListItem(container, block, contentWidth);
  } else if (block.type === 'hr') {
    await renderHr(container, contentWidth);
  } else {
    await renderParagraph(container, block, contentWidth);
  }
}

async function renderHeader(container: FrameNode, block: Block, contentWidth: number) {
  var textNode = figma.createText();
  var fullText = '';
  for (var i = 0; i < block.segments.length; i++) {
    fullText += block.segments[i].text;
  }

  textNode.fontName = FONTS.bold;
  textNode.characters = fullText;

  var sizes: { [key: number]: number } = { 1: 24, 2: 20, 3: 17, 4: 15, 5: 14, 6: 13 };
  var level = block.level || 1;
  textNode.fontSize = sizes[level] || 15;
  textNode.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  textNode.lineHeight = { value: 150, unit: 'PERCENT' };
  textNode.resize(contentWidth, textNode.height);
  textNode.textAutoResize = 'HEIGHT';

  container.appendChild(textNode);
}

async function renderCodeBlock(container: FrameNode, block: Block, contentWidth: number) {
  var codeFrame = figma.createFrame();
  codeFrame.name = "Code Block";
  codeFrame.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.98 } }];
  codeFrame.cornerRadius = 8;
  codeFrame.layoutMode = 'VERTICAL';
  codeFrame.primaryAxisSizingMode = 'AUTO';
  codeFrame.counterAxisSizingMode = 'AUTO';
  codeFrame.paddingTop = 14;
  codeFrame.paddingBottom = 14;
  codeFrame.paddingLeft = 16;
  codeFrame.paddingRight = 16;

  var codeText = figma.createText();
  codeText.fontName = FONTS.mono;
  codeText.characters = block.rawText || '';
  codeText.fontSize = 12;
  codeText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.25, b: 0.3 } }];
  codeText.lineHeight = { value: 165, unit: 'PERCENT' };
  codeText.resize(contentWidth - 32, codeText.height); // contentWidth minus left+right padding
  codeText.textAutoResize = 'HEIGHT';

  codeFrame.appendChild(codeText);
  container.appendChild(codeFrame);
}

async function renderBlockquote(container: FrameNode, block: Block, contentWidth: number) {
  var quoteFrame = figma.createFrame();
  quoteFrame.name = "Blockquote";
  quoteFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  quoteFrame.layoutMode = 'HORIZONTAL';
  quoteFrame.primaryAxisSizingMode = 'AUTO';
  quoteFrame.counterAxisSizingMode = 'AUTO';
  quoteFrame.itemSpacing = 14;
  quoteFrame.paddingTop = 12;
  quoteFrame.paddingBottom = 12;
  quoteFrame.paddingLeft = 0;
  quoteFrame.paddingRight = 16;
  quoteFrame.cornerRadius = 4;

  // Left border
  var border = figma.createRectangle();
  border.resize(4, 24);
  border.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.75 } }];
  border.cornerRadius = 2;
  quoteFrame.appendChild(border);

  var quoteText = figma.createText();
  quoteText.fontName = FONTS.italic;
  var fullText = '';
  for (var i = 0; i < block.segments.length; i++) {
    fullText += block.segments[i].text;
  }
  quoteText.characters = fullText;
  quoteText.fontSize = 13;
  quoteText.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.35, b: 0.4 } }];
  quoteText.lineHeight = { value: 165, unit: 'PERCENT' };
  quoteText.resize(contentWidth - 34, quoteText.height); // contentWidth minus border spacing and padding
  quoteText.textAutoResize = 'HEIGHT';

  quoteFrame.appendChild(quoteText);

  // Adjust border height
  border.resize(4, Math.max(24, quoteText.height));

  container.appendChild(quoteFrame);
}

async function renderListItem(container: FrameNode, block: Block, contentWidth: number) {
  var listFrame = figma.createFrame();
  listFrame.name = "List Item";
  listFrame.fills = [];
  listFrame.layoutMode = 'HORIZONTAL';
  listFrame.primaryAxisSizingMode = 'AUTO';
  listFrame.counterAxisSizingMode = 'AUTO';
  listFrame.itemSpacing = 10;
  listFrame.counterAxisAlignItems = 'MIN';

  var bullet = figma.createText();
  bullet.fontName = FONTS.regular;
  bullet.characters = "•";
  bullet.fontSize = 14;
  bullet.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
  listFrame.appendChild(bullet);

  // Create rich text for list content
  var textNode = await createRichText(block.segments, contentWidth - 24); // contentWidth minus bullet and spacing
  listFrame.appendChild(textNode);

  container.appendChild(listFrame);
}

async function renderHr(container: FrameNode, contentWidth: number) {
  var hr = figma.createRectangle();
  hr.name = "Horizontal Rule";
  hr.resize(contentWidth, 1);
  hr.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];
  hr.layoutAlign = 'STRETCH';
  container.appendChild(hr);
}

async function renderParagraph(container: FrameNode, block: Block, contentWidth: number) {
  var textNode = await createRichText(block.segments, contentWidth);
  container.appendChild(textNode);
}

function isValidAbsoluteUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Figma only supports http and https protocols
  var trimmedUrl = url.trim();
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
}

async function createRichText(segments: InlineSegment[], width: number): Promise<TextNode> {
  var textNode = figma.createText();

  // Build full text first
  var fullText = '';
  for (var i = 0; i < segments.length; i++) {
    fullText += segments[i].text;
  }

  if (!fullText.trim()) {
    fullText = ' ';
  }

  // Set initial font and text
  textNode.fontName = FONTS.regular;
  textNode.characters = fullText;
  textNode.fontSize = 14;
  textNode.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
  textNode.lineHeight = { value: 150, unit: 'PERCENT' };

  // Apply styles to ranges
  var pos = 0;
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var start = pos;
    var end = pos + seg.text.length;

    if (seg.text.length > 0 && end <= fullText.length) {
      // Determine font
      var font = FONTS.regular;
      if (seg.code) {
        font = FONTS.mono;
      } else if (seg.bold && seg.italic) {
        font = FONTS.boldItalic;
      } else if (seg.bold) {
        font = FONTS.bold;
      } else if (seg.italic) {
        font = FONTS.italic;
      }

      textNode.setRangeFontName(start, end, font);

      // Code styling
      if (seg.code) {
        textNode.setRangeFontSize(start, end, 13);
        textNode.setRangeFills(start, end, [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.3 } }]);
      }

      // Link styling
      if (seg.link) {
        textNode.setRangeFills(start, end, [{ type: 'SOLID', color: { r: 0.0, g: 0.45, b: 0.9 } }]);
        textNode.setRangeTextDecoration(start, end, 'UNDERLINE');

        // Only set hyperlink if it's a valid absolute URL
        if (isValidAbsoluteUrl(seg.link)) {
          textNode.setRangeHyperlink(start, end, { type: 'URL', value: seg.link });
        }
      }
    }

    pos = end;
  }

  textNode.resize(width, textNode.height);
  textNode.textAutoResize = 'HEIGHT';

  return textNode;
}

figma.ui.postMessage({ type: 'init' });
