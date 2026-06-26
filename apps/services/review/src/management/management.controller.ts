import { Controller, Get } from '@nestjs/common';

@Controller()
export class ManagementController {
  @Get('live')
  live() {
    return { ok: true };
  }

  @Get('ready')
  ready() {
    return { ok: true };
  }
}
