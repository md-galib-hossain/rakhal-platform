import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from 'src/modules/user/user.service';

@Controller('users')
export class UserController {
  userService: UserService;
  constructor(userService: UserService) {
    this.userService = userService;
  }

  @Get()
  getUsers() {
    return this.userService.findAll();
  }

  @Post()
  createUser(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
