import { Session } from './Session';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  findByCourse(courseId: string): Promise<Session[]>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
}
