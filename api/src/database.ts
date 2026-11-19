import 'reflect-metadata';
import {config} from 'dotenv';
import {DataSource,DataSourceOptions} from 'typeorm';
import {z} from 'zod';
import {Initial1795000000000} from './migrations/initial';
config({quiet:true});
const env=z.object({DB_HOST:z.string().min(1),DB_PORT:z.coerce.number().int().min(1).max(65535),DB_NAME:z.string().min(1),DB_USER:z.string().min(1),DB_PASSWORD:z.string().min(1),PORT:z.coerce.number().int().min(1).max(65535),FRONTEND_ORIGIN:z.url()}).parse(process.env);
if(new URL(env.FRONTEND_ORIGIN).origin!==env.FRONTEND_ORIGIN)throw new Error('FRONTEND_ORIGIN csak origint tartalmazhat.');
export {env};
export const options:DataSourceOptions={type:'mysql',host:env.DB_HOST,port:env.DB_PORT,database:env.DB_NAME,username:env.DB_USER,password:env.DB_PASSWORD,charset:'utf8mb4',timezone:'Z',dateStrings:true,synchronize:false,migrations:[Initial1795000000000]};
export default new DataSource(options);

