import type { Config } from 'jest'

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '../..',
    testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/apps/web/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/web/$1',
        '^@restaurant-qr/shared$': '<rootDir>/packages/shared/src',
        '^@restaurant-qr/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    },
    setupFiles: ['<rootDir>/apps/web/jest.setup.ts'],
    // Integration tests hit a real Supabase instance; auth user CRUD + seeding
    // is slow enough that the default 5 000 ms causes cascading failures.
    testTimeout: 30_000,
    // All test files share the same local database. Running in parallel causes
    // cross-file interference: one file's resetDatabase() wipes rows another
    // file's seedTestData() just inserted, leading to FK violations.
    maxWorkers: 1,
}

export default config
