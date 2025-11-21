// Enhanced CSS filtering utility function
function cleanJobTitle(rawTitle: string, element: any): string {
  if (!rawTitle) return '';
  
  // Enhanced CSS cleaning specifically for StepStone patterns
  if (rawTitle.includes('{') || rawTitle.includes('res-') || /^[a-zA-Z0-9-_]+\{/.test(rawTitle)) {
    // Advanced CSS cleaning for StepStone patterns
    rawTitle = rawTitle
      .replace(/^\.[a-zA-Z0-9-_]+\{/, '') // Remove leading .res-xxx{
      .replace(/\{[^}]*\}/g, '') // Remove CSS rules
      .replace(/\.[a-zA-Z0-9-_]+\{/g, '') // Remove CSS class definitions
      .replace(/\.[a-zA-Z0-9-_]+/g, '') // Remove remaining CSS classes
      .replace(/@media[^{]*\{[^}]*\}/g, '') // Remove media queries
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Enhanced fallback: try multiple extraction strategies
    if (rawTitle.includes('{') || rawTitle.length < 10 || /^[a-zA-Z0-9-_]*$/.test(rawTitle)) {
      const parent = $(element).closest('article, div[class*="job"], li[class*="job"], tr[class*="job"]');
      const allText = parent.text().trim();
      
      // Multiple keyword patterns for better matching
      const jobKeywords = /(Software\s+(Entwickler|Developer)|Developer|Engineer|Manager|Architect|Consultant|Analyst|Programmierer|Entwickler|Embedded|Aerospace|Hardware|Firmware|Bildverarbeitung|Angular|X\+\+|Dynamics)/i;
      const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 5 && !line.includes('{') && !line.includes('res-'));
      
      for (const line of lines) {
        if (jobKeywords.test(line) && !line.includes('{') && line.length > 10 && !/^[a-zA-Z0-9-_]+$/.test(line)) {
          rawTitle = line;
          break;
        }
      }
      
      // Last resort: try to extract from link text
      if (rawTitle.length < 10) {
        const linkText = $(element).find('a').first().text().trim();
        if (linkText && jobKeywords.test(linkText) && !linkText.includes('{')) {
          rawTitle = linkText;
        }
      }
    }
  }
  
  return rawTitle;
}