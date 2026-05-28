export abstract class ValueObject<T> {
  constructor(public readonly props: T) {}

  public equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
