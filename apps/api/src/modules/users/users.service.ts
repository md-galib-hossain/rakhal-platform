import { Injectable } from '@nestjs/common';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 1;

  findAll(): User[] {
    return this.users;
  }

  create(createUserDto: CreateUserDto): User {
    const newUser: User = {
      id: this.idCounter++,
      ...createUserDto,
    };

    this.users.push(newUser);
    return newUser;
  }
}
