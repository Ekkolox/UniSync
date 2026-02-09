// Placeholder parser for Copperbelt University (CBU)
// TODO: Needs adjustment based on actual CBU student portal HTML structure.

export class CBUParser {
  constructor(htmlContent) {
    this.parser = new DOMParser();
    this.doc = this.parser.parseFromString(htmlContent, 'text/html');
  }

  parse() {
    console.log("Using CBU Parser");
    return []; // Template for future implementation
  }
}
