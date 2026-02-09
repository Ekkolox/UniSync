import { ZCASParser } from './parsers/zcas.js';

export class ParserFactory {
  static getParser(type, htmlContent) {
    switch (type) {
      case 'zcas':
        return new ZCASParser(htmlContent);
      default:
        // Default to ZCAS for backward compatibility
        console.warn(`Unknown parser type '${type}', defaulting to ZCAS.`);
        return new ZCASParser(htmlContent);
    }
  }
}
