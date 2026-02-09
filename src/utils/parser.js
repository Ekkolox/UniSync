import { ZCASParser } from './parsers/zcas.js';
import { UNZAParser } from './parsers/unza.js';
import { CBUParser } from './parsers/cbu.js';
import { UnilusParser } from './parsers/unilus.js';

export class ParserFactory {
  static getParser(type, htmlContent) {
    switch (type) {
      case 'zcas':
        return new ZCASParser(htmlContent);
      case 'unza':
        return new UNZAParser(htmlContent);
      case 'cbu':
        return new CBUParser(htmlContent);
      case 'unilus':
        return new UnilusParser(htmlContent);
      default:
        // Default to ZCAS for backward compatibility
        console.warn(`Unknown parser type '${type}', defaulting to ZCAS.`);
        return new ZCASParser(htmlContent);
    }
  }
}
