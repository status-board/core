module.exports = {
  'env': {
    'browser': true,
    'es6': true,
    'jest': true
  },
  'extends': ['airbnb-base', 'plugin:@typescript-eslint/recommended'],
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly'
  },
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 2018,
    'sourceType': 'module',
    'project': './tsconfig.json'
  },
  'plugins': ['@typescript-eslint', 'jest', 'import'],
  'settings': {
    'import/resolver': {
      'node': {
        'extensions': ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  'rules': {
    '@typescript-eslint/explicit-function-return-type': "off",
    '@typescript-eslint/no-explicit-any': "off",
    '@typescript-eslint/explicit-member-accessibility': "off",
    'no-param-reassign': "off",
    'prefer-promise-reject-errors': "off",
    'global-require': "off",
    'import/no-dynamic-require': "off",
    'import/no-extraneous-dependencies': "off",
    'max-len': "off",
    'import/prefer-default-export': "off",
  }
};
