import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export const PARTICIPATION_SYMBOLS = ['PLUS', 'MINUS', 'WELLE'] as const;
export type ParticipationSymbolType = (typeof PARTICIPATION_SYMBOLS)[number];

const SCORE_MAP: Record<ParticipationSymbolType, number> = {
  PLUS: 2.0,
  WELLE: 1.0,
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
          `Invalid ParticipationSymbol: "${raw}". Must be PLUS, MINUS, or WELLE`,
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
