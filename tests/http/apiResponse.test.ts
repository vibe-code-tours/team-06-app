import { ok, err } from '@restaurant-qr/shared/http/apiResponse';

describe('apiResponse', () => {
  it('ok() wraps data in a { data } envelope with default status 200', async () => {
    const res = ok({ id: '1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { id: '1' } });
  });

  it('ok() respects an explicit status', async () => {
    const res = ok({ id: '1' }, 201);
    expect(res.status).toBe(201);
  });

  it('err() wraps code/message/details in an { error } envelope', async () => {
    const res = err('VALIDATION_ERROR', 'name is required', 400, { field: 'name' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'name is required', details: { field: 'name' } },
    });
  });

  it('err() omits details when not provided', async () => {
    const res = err('UNAUTHORIZED', 'Unauthorized', 401);
    const body = (await res.json()) as { error: { code: string; message: string; details?: unknown } };
    expect(body.error.details).toBeUndefined();
  });
});
