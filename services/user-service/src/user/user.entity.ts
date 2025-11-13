import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export interface UserPreference {
  email: boolean;
  push: boolean;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({ type: 'varchar', nullable: true })
  push_token: string | null;

  @Column({ type: 'jsonb' })
  preferences: UserPreference;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
