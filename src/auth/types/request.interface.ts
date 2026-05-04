import { Request } from 'express';
import { Role } from 'src/users/enums/role.enums';

export interface UserRequest extends Request {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}
