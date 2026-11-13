export interface RandomSource {
  /** Número uniforme em [0, 1). */
  next(): number;
}
