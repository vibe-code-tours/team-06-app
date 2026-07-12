import { generateTableQrDataUrl } from './index';

describe('generateTableQrDataUrl', () => {
  it('returns a base64 PNG data URL encoding the table menu path', async () => {
    const dataUrl = await generateTableQrDataUrl(
      '3f2e1a10-0000-4000-8000-000000000001',
      7,
      'https://example-restaurant.app'
    );

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
