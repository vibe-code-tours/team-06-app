import { NextResponse } from 'next/server'

export type ErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'INTERNAL_ERROR'

export function ok<T>(data: T, status = 200) {
    return NextResponse.json({ data }, { status })
}

export function err(code: ErrorCode, message: string, status: number, details?: unknown) {
    return NextResponse.json(
        { error: { code, message, ...(details !== undefined ? { details } : {}) } },
        { status }
    )
}
