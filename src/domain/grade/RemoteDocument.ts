import { Finding } from './Finding';

export class RemoteDocument extends Finding {
  private _url: string;

  constructor(id: string, url: string) {
    super(id);
    this._url = url;
  }

  get url(): string {
    return this._url;
  }
}
