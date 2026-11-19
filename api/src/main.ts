import 'reflect-metadata';
import { ConsoleLogger, Controller, Get, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
config({quiet:true});
@Controller()
class HealthController {
  @Get('health') health() { return {status:'ok'}; }
}
@Module({controllers:[HealthController]})
class AppModule {}
async function start() {
  const app = await NestFactory.create(AppModule, {logger:new ConsoleLogger({json:true})});
  app.setGlobalPrefix('api/v1');
  app.use(helmet(), cookieParser());
  app.useGlobalPipes(new ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true}));
  app.enableCors({origin:process.env.FRONTEND_ORIGIN, credentials:true});
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
}
void start();

