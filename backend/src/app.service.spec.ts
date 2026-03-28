// AI assisted development
import { AppService } from './app.service';

describe('AppService', () => {
  it('health returns service payload', () => {
    const service = new AppService();
    expect(service.health()).toEqual({
      status: 'ok',
      service: 'transparency-dashboard-api',
    });
  });
});
