module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/lib'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
        '^lib/(.*)$': '<rootDir>/lib/$1',
        '^constants/(.*)$': '<rootDir>/constants/$1',
        '^Components/(.*)$': '<rootDir>/Components/$1',
        '^@/(.*)$': '<rootDir>/$1',
    },
    clearMocks: true,
};
