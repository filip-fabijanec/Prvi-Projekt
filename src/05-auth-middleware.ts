import { Express, Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
dotenv.config()

type User = {
  username : string
}

declare global {
  namespace Express {
      export interface Request {
          user? : User
      }
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      COOKIE_KEY : string
    }
  }
}

function initCookieAuth(app : Express) {
  app.use(cookieParser(process.env.COOKIE_KEY));
  app.use(setUserInfo);
}

function signInUser(res : Response, username : string) {
  res.cookie('user', username, {
      signed : true,
      httpOnly: true
  });
}

function signOutUser(res : Response) {
  res.clearCookie('user');
}

function setUserInfo(req : Request, res : Response, next : NextFunction) {    
  const username = req.signedCookies?.user;  
  if (username) { 
    req.user = {      
      username
    };
  }  
  next(); 
}
  
export {initCookieAuth, signInUser, signOutUser};