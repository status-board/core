import C from '../../src/index';

describe('Testing C class', () => {
  test('that getX returns 10', () => {
    const classToTest = new C();

    expect(classToTest.getX()).toEqual(10);
  });

  test('that setX sets value', () => {
    const classToTest = new C();

    expect(classToTest.getX()).toEqual(10);

    classToTest.setX(5);

    expect(classToTest.getX()).toEqual(5);
  })
});
