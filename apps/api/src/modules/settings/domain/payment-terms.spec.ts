import { parsePaymentTermsDays } from './payment-terms';

describe('parsePaymentTermsDays (RD-068)', () => {
  it.each([
    [null, 0],
    [undefined, 0],
    ['', 0],
    ['cod', 0],
    ['COD', 0],
    ['  cod  ', 0],
    ['net_7', 7],
    ['net_30', 30],
    ['NET_15', 15],
    ['net-45', 45],
    ['net60', 60],
    ['unrecognized', 0],
    ['net_', 0],
  ])('parsePaymentTermsDays(%p) === %p', (input, expected) => {
    expect(parsePaymentTermsDays(input)).toBe(expected);
  });
});
