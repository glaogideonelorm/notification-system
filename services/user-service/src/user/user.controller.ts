import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';

// --- Unified Response Helper ---
const createResponse = (data: any, message: string, success = true) => ({
  success,
  message,
  data: data || null,
  error: success ? null : 'error',
  meta: {
    total: data ? (Array.isArray(data) ? data.length : 1) : 0,
    limit: 1,
    page: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
});

@Controller('api/v1/users')
@UsePipes(new ValidationPipe({ transform: true }))
export class UserController {
  constructor(private readonly userService: UserService) {}

  // --- Health Check ---
  @Get('health')
  getHealth() {
    return createResponse(null, 'User Service is Up');
  }

  // --- Registration ---
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.register_user(createUserDto);
    return createResponse(
      { user_id: user.user_id, email: user.email },
      'User registered successfully',
    );
  }

  // --- Login---
  @Post('login')
  async login(@Body() body: any) {
    const { email } = body;
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return createResponse(null, 'Invalid credentials', false);
    }
    return createResponse({ user_id: user.user_id, email: user.email }, 'Login successful');
  }

  // --- Get User Info ---
  @Get(':id')
  async getUserData(@Param('id') id: string) {
    const user = await this.userService.get_contact_info(id);
    return createResponse(user, 'User contact info retrieved');
  }

  // --- Get User Preferences ---
  @Get(':id/preferences')
  async getUserPreferences(@Param('id') id: string) {
    const prefs = await this.userService.getUserPrefs(id);
    return createResponse(prefs, 'User preferences retrieved');
  }

  // --- Update Preferences ---
  @Put(':id/preferences')
  async updatePreferences(
    @Param('id') id: string,
    @Body() updatePrefsDto: UpdatePrefsDto,
  ) {
    await this.userService.updateUserPrefs(id, updatePrefsDto);
    return createResponse(null, 'User preferences updated');
  }
}
