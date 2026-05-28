import { ValueObject } from '../shared/ValueObject';

interface AdditionalInformationProps {
  key: string;
  value: string;
}

export class AdditionalInformation extends ValueObject<AdditionalInformationProps> {
  constructor(key: string, value: string) {
    super({ key, value });
  }

  get key(): string {
    return this.props.key;
  }

  get value(): string {
    return this.props.value;
  }

  equals(other: AdditionalInformation): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    return this.key === other.key;
  }
}
