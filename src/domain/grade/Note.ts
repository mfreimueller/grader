import { Finding } from './Finding';

export class Note extends Finding {
  private _text: string;

  constructor(id: string, text: string) {
    super(id);
    this._text = text;
  }

  get text(): string {
    return this._text;
  }
}
