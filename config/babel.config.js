export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '18.0.0'
        },
        useBuiltIns: 'usage',
        corejs: 3,
        modules: 'auto'
      }
    ]
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-private-methods',
    '@babel/plugin-proposal-private-property-in-object',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-transform-runtime'
  ],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current'
            },
            modules: 'commonjs'
          }
        ]
      ],
      plugins: [
        '@babel/plugin-transform-runtime',
        'babel-plugin-dynamic-import-node'
      ]
    },
    production: {
      plugins: [
        'babel-plugin-transform-remove-console',
        'babel-plugin-transform-remove-debugger'
      ]
    },
    development: {
      plugins: [
        '@babel/plugin-transform-runtime'
      ]
    }
  },
  ignore: [
    'node_modules',
    'dist',
    'build',
    'coverage'
  ]
};