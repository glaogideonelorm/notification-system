// user.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';
import { RedisService } from './redis/redis.service';

const SALT_ROUNDS = 10;
const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async register_user(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOneBy({
      email: createUserDto.email,
    });

    if (existing) {
      throw new BadRequestException('user_already_exists');
    }

    const password_hash = await bcrypt.hash(
      createUserDto.password,
      SALT_ROUNDS,
    );

    const newUser = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password_hash,
      push_token: createUserDto.push_token || null,
      preferences: createUserDto.preferences,
    });

    return this.userRepository.save(newUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async get_contact_info(user_id: string): Promise<Partial<User>> {
    const cacheKey = `user:${user_id}:contact`;

    const cachedUser = await this.redisService.get(cacheKey);
    if (cachedUser) return JSON.parse(cachedUser);

    const user = await this.userRepository.findOne({
      where: { user_id },
      select: [
        'user_id',
        'name',
        'email',
        'push_token',
        'preferences',
        'created_at',
      ],
    });

    if (!user) throw new NotFoundException('user_not_found');

    await this.redisService.set(
      cacheKey,
      JSON.stringify(user),
      CACHE_TTL_SECONDS,
    );
    return user;
  }

  async getUserPrefs(user_id: string) {
    const cacheKey = `user:${user_id}:prefs`;

    const cachedPrefs = await this.redisService.get(cacheKey);
    if (cachedPrefs) return JSON.parse(cachedPrefs);

    const user = await this.userRepository.findOne({
      where: { user_id },
      select: ['user_id', 'preferences', 'push_token'],
    });

    if (!user) throw new NotFoundException('user_not_found');

    await this.redisService.set(
      cacheKey,
      JSON.stringify(user),
      CACHE_TTL_SECONDS,
    );
    return user;
  }

  async updateUserPrefs(user_id: string, updatePrefsDto: UpdatePrefsDto) {
    const user = await this.userRepository.findOneBy({ user_id });
    if (!user) throw new NotFoundException('user_not_found');

    if (updatePrefsDto.push_token !== undefined) {
      user.push_token = updatePrefsDto.push_token || null;
    }

    if (updatePrefsDto.preferences !== undefined) {
      user.preferences = updatePrefsDto.preferences;
    }

    await this.userRepository.save(user);

    await this.redisService.del(`user:${user_id}:prefs`);
    await this.redisService.del(`user:${user_id}:contact`);

    return { message: 'preferences_updated_successfully' };
  }
}
