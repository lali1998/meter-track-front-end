import {Body,CanActivate,Controller,ExecutionContext,ForbiddenException,Get,HttpException,Injectable,Post,Req,Res,UnauthorizedException,UseGuards} from '@nestjs/common';
import type {Request,Response} from 'express';
import {IsEmail,IsString,MaxLength,MinLength} from 'class-validator';
import {randomBytes,createHash} from 'node:crypto';
import * as argon2 from 'argon2';
import {DataSource} from 'typeorm';
export const sessionName='rf_session';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export interface Actor {id:number;email:string;propertyId:number;propertyName:string;readingDay:number}
export type Authed=Request & {actor:Actor};
@Injectable()
export class Access implements CanActivate {
 constructor(private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<Authed>();
 const token=req.cookies?.[sessionName];if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))throw new UnauthorizedException('Jelentkezz be.');
 const users:Actor[]=await this.db.query('SELECT u.id,u.email,p.id propertyId,p.name propertyName,p.reading_day readingDay FROM sessions s JOIN users u ON u.id=s.user_id JOIN property_access a ON a.user_id=u.id JOIN properties p ON p.id=a.property_id WHERE s.token=? AND s.expires_at>UTC_TIMESTAMP() ORDER BY p.id',[digest(token)]);
 if(!users.length)throw new UnauthorizedException('A munkamenet lejárt.');const actor=req.params['id']?users.find(u=>String(u.propertyId)===req.params['id']):users[0];if(!actor)throw new ForbiddenException('Nincs hozzáférés az ingatlanhoz.');req.actor=actor;return true;}
}
class LoginDto {@IsEmail() @MaxLength(255) email!:string; @IsString() @MinLength(1) @MaxLength(256) password!:string;}
class PasswordDto {@IsString() @MaxLength(256) current!:string; @IsString() @MinLength(12) @MaxLength(256) password!:string;}
@Controller('auth')
export class AuthController {
 private attempts=new Map<string,{count:number;until:number}>();
 constructor(private db:DataSource){}
 @Post('login') async login(@Body() body:LoginDto,@Req() req:Request,@Res({passthrough:true}) res:Response){
 const now=Date.now(),key=req.ip||'local';for(const [k,v] of this.attempts)if(v.until<=now)this.attempts.delete(k);
 const entry=this.attempts.get(key)??{count:0,until:now+600000};if(entry.count>=10)throw new HttpException('Túl sok próbálkozás. Próbáld később.',429);entry.count++;this.attempts.set(key,entry);
 const [u]=await this.db.query('SELECT id,password_hash FROM users WHERE email=?',[body.email.trim().toLowerCase()]);
 if(!u||!await argon2.verify(u.password_hash,body.password))throw new UnauthorizedException('Hibás e-mail-cím vagy jelszó.');
 this.attempts.delete(key);const token=randomBytes(32).toString('hex');await this.db.query('DELETE FROM sessions WHERE expires_at<=UTC_TIMESTAMP()');
 await this.db.query('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR))',[digest(token),u.id]);
 res.cookie(sessionName,token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api',maxAge:43200000});return {ok:true};}
 @Get('me') @UseGuards(Access) me(@Req() r:Authed){return r.actor;}
 @Post('logout') @UseGuards(Access) async logout(@Req() r:Authed,@Res({passthrough:true}) res:Response){await this.db.query('DELETE FROM sessions WHERE token=?',[digest(r.cookies[sessionName])]);res.clearCookie(sessionName,{path:'/api'});return {ok:true};}
 @Post('password') @UseGuards(Access) async password(@Req() r:Authed,@Body() b:PasswordDto){await this.db.transaction(async m=>{const [u]=await m.query('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[r.actor.id]);if(!await argon2.verify(u.password_hash,b.current))throw new UnauthorizedException('Hibás jelenlegi jelszó.');await m.query('UPDATE users SET password_hash=? WHERE id=?',[await argon2.hash(b.password),r.actor.id]);await m.query('DELETE FROM sessions WHERE user_id=?',[r.actor.id]);});return {ok:true};}
}

