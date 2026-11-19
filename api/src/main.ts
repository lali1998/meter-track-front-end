import 'reflect-metadata';
import {BadRequestException,Catch,ConsoleLogger,Controller,Get,Module,ValidationPipe} from '@nestjs/common';
import type {ExceptionFilter,ArgumentsHost} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {TypeOrmModule} from '@nestjs/typeorm';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type {Request,Response,NextFunction} from 'express';
import {ZodError} from 'zod';
import {env,options} from './database';
import {Access,AuthController} from './security';
import {PropertyController} from './property';
import {Periods} from './periods';
@Controller() class HealthController {@Get('health') health(){return {status:'ok'};}}
@Catch(ZodError) class InputErrors implements ExceptionFilter {catch(e:ZodError,ctx:ArgumentsHost){ctx.switchToHttp().getResponse<Response>().status(400).json({statusCode:400,message:e.issues.map(i=>i.path.join('.')+' '+i.message).join(' · ')});}}
@Module({imports:[TypeOrmModule.forRoot(options)],controllers:[HealthController,AuthController,PropertyController,Periods],providers:[Access]})
export class AppModule {}
async function start(){const app=await NestFactory.create(AppModule,{logger:new ConsoleLogger({json:true})});app.setGlobalPrefix('api/v1');
const frontend = new URL(env.FRONTEND_ORIGIN);
const allowedOrigins = [frontend.origin];
if (process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1','[::1]'].includes(frontend.hostname)) {
  for (const hostname of ['localhost','127.0.0.1','[::1]']) {
    frontend.hostname = hostname;
    if (!allowedOrigins.includes(frontend.origin)) allowedOrigins.push(frontend.origin);
  }
}
app.use(helmet(),cookieParser());app.use((r:Request,res:Response,next:NextFunction)=>{if(!['GET','HEAD','OPTIONS'].includes(r.method)&&!allowedOrigins.includes(r.headers.origin ?? '')){res.status(403).json({message:'Érvénytelen kérési eredet.'});return;}next();});
app.useGlobalFilters(new InputErrors());app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,exceptionFactory:()=>new BadRequestException('Érvénytelen űrlapadatok.')}));
app.enableCors({origin:allowedOrigins,credentials:true});await app.listen(env.PORT,process.env.BIND_HOST||'127.0.0.1');}
if(require.main===module)void start();

