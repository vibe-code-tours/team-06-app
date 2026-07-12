import type { Config } from 'jest'

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '../..',
    testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/apps/web/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/web/$1',
        '^@restaurant-qr/shared$': '<rootDir>/packages/shared/src',
    },
    setupFiles: ['<rootDir>/apps/web/jest.setup.ts'],
}

export default config
