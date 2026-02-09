/**
 * Example test to verify Jest setup
 */

describe('OpenCode PM Sync Plugin', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should add numbers correctly', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });
});

describe('TypeScript type checking', () => {
  it('should infer types correctly', () => {
    const message: string = 'Hello, OpenCode!';
    expect(typeof message).toBe('string');
  });

  it('should work with arrays', () => {
    const numbers: number[] = [1, 2, 3, 4, 5];
    expect(numbers.length).toBe(5);
    expect(numbers[0]).toBe(1);
  });
});
