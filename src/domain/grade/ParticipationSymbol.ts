import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

// Plus-Welle (+~) and Minus-Welle (−~) sit between Welle and a clear Plus or Minus.
export const PARTICIPATION_SYMBOLS = ['PLUS', 'PLUS_WELLE', 'WELLE', 'MINUS_WELLE', 'MINUS'] as const;
export type ParticipationSymbolType = (typeof PARTICIPATION_SYMBOLS)[number];

const SCORE_MAP: Record<ParticipationSymbolType, number> = {
  PLUS: 1.0,
  PLUS_WELLE: 0.75,
  WELLE: 0.5,
  MINUS_WELLE: 0.25,
  MINUS: 0.0,
};

interface ParticipationSymbolProps {
  value: ParticipationSymbolType;
}

export class ParticipationSymbol extends ValueObject<ParticipationSymbolProps> {
  private constructor(value: ParticipationSymbolType) {
    super({ value });
  }

  static create(raw: string): Result<ParticipationSymbol> {
    const upper = raw.toUpperCase();
    if (!PARTICIPATION_SYMBOLS.includes(upper as ParticipationSymbolType)) {
      return Result.fail(
        new ValidationError(
          `Invalid ParticipationSymbol: "${raw}". Must be one of ${PARTICIPATION_SYMBOLS.join(', ')}`,
        ),
      );
    }
    return Result.ok(new ParticipationSymbol(upper as ParticipationSymbolType));
  }

  get value(): ParticipationSymbolType {
    return this.props.value;
  }

  toScore(): number {
    return SCORE_MAP[this.value];
  }
}
