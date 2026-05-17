from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False) # HR / CANDIDATE
    created_at = Column(DateTime, default=datetime.utcnow)

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    required_skills = Column(JSON, nullable=False)
    weightage = Column(JSON, nullable=False)
    cutoff_round_1 = Column(Float, nullable=False)
    cutoff_round_2 = Column(Float, nullable=False)
    cutoff_round_3 = Column(Float, nullable=False)
    cutoff_round_4 = Column(Float, nullable=False)
    cutoff_round_5 = Column(Float, nullable=False)
    max_attempts = Column(Integer, default=1)
    
class Application(Base):
    __tablename__ = "applications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"))
    current_stage = Column(String, default="ROUND_1") # ROUND_1..ROUND_5, HIRED, REJECTED
    attempt_count = Column(Integer, default=0)
    overall_status = Column(String, default="IN_PROGRESS")
    created_at = Column(DateTime, default=datetime.utcnow)

class StageResult(Base):
    __tablename__ = "stage_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"))
    stage_name = Column(String, nullable=False)
    ai_score = Column(Float, nullable=True)
    human_score = Column(Float, nullable=True)
    final_stage_score = Column(Float, nullable=True)
    feedback_json = Column(JSON, nullable=True)
    status = Column(String, nullable=False) # PASS / FAIL
    completed_at = Column(DateTime, default=datetime.utcnow)
