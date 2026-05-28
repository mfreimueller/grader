import { Finding } from './Finding';

export class Document extends Finding {
  private _filePath: string;

  constructor(id: string, filePath: string) {
    super(id);
    this._filePath = filePath;
  }

  get filePath(): string {
    return this._filePath;
  }
}
