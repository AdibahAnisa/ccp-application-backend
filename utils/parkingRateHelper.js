const prices = {
  Pahang: {
    1: 0.65,
    2: 1.3,
    3: 1.95,
    4: 2.6,
    5: 3.25,
    6: 4.55,
    24: 4.8,
  },
  Kelantan: {
    0.5: 0.3,
    1: 0.6,
    2: 1.2,
    3: 1.8,
    4: 2.4,
    5: 3.0,
    6: 3.6,
    7: 4.2,
    8: 4.8,
    9: 5.4,
    10: 6.0,
  },
  Terengganu: {
    0.5: 0.4,
    1: 0.8,
    2: 1.6,
    3: 2.4,
    4: 3.2,
    5: 4.0,
    6: 4.8,
    7: 5.6,
    8: 6.4,
    9: 7.2,
    10: 8.0,
  },
};

export const getParkingAmount = (state, hours) => {
  const statePrices = prices[state];

  if (!statePrices) {
    throw new Error(`Invalid parking state: ${state}`);
  }

  const amount = statePrices[hours];

  if (amount === undefined) {
    throw new Error(`Invalid parking hour ${hours} for ${state}`);
  }

  return amount;
};
