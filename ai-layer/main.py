from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Annotated
import os
import random
import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Hiring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# -- Models --

class JobDescriptionRequest(BaseModel):
    job_title: str
    department: str
    location: str

class JobDescriptionResponse(BaseModel):
    summary: str
    responsibilities: List[str]
    required_skills: List[str]

class TestGenerationRequest(BaseModel):
    job_id: str
    skills: List[str]

class EvaluateScreeningRequest(BaseModel):
    answers: List[Dict[str, Any]]

class TestGenerationResponse(BaseModel):
    questions: List[Dict[str, Any]]

class AnalyzeCodingRequest(BaseModel):
    code: str
    language: str = "java"

class AnalyzeCodingResponse(BaseModel):
    aiScore: int
    feedback: Dict[str, str]

class GenerateHRKitRequest(BaseModel):
    job_description: str
    skills: List[str]

class ComputeDecisionRequest(BaseModel):
    stage_scores: List[float]
    github_score: float
    linkedin_score: float
    experience_years: int

class ComputeDecisionResponse(BaseModel):
    final_score: float
    confidence_index: float
    recommendation: str
    reasoning: List[str]

class AnalyzeProfileRequest(BaseModel):
    github_url: str | None = None
    linkedin_url: str | None = None
    candidate_email: str | None = None

class AnalyzeProfileResponse(BaseModel):
    github_score: int
    linkedin_score: int
    detected_skills: List[str]
    github_summary: str
    linkedin_summary: str

class OfferLetterRequest(BaseModel):
    candidate_name: str
    role: str | None = None
    job_title: str | None = None
    salary: str = "Competitive"
    joining_date: str = "To be discussed"
    company: str = "AI Hirer"

class OfferLetterResponse(BaseModel):
    offer_letter_content: str

class VideoAnalysisResponse(BaseModel):
    transcript: str
    summary: str
    recommendation: str
    reasons: List[str]

# -- Helpers --

async def get_github_data(username: str):
    headers = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}
    async with httpx.AsyncClient() as client:
        try:
            # Get user info
            resp = await client.get(f"https://api.github.com/users/{username}", headers=headers)
            user_data = resp.json() if resp.status_code == 200 else {}
            
            # Get repos
            resp = await client.get(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=100", headers=headers)
            repos = resp.json() if resp.status_code == 200 else []
            
            return user_data, repos
        except Exception as e:
            print(f"Error fetching GitHub data: {e}")
            return {}, []

# -- Endpoints --

@app.post("/ai/generate-job-description")
def generate_job_description(request: JobDescriptionRequest) -> JobDescriptionResponse:
    # Simulating AI generation
    return JobDescriptionResponse(
        summary=f"We are looking for a {request.job_title} to join our {request.department} team in {request.location}. The ideal candidate will have strong technical skills and a passion for building scalable solutions.",
        responsibilities=[
            f"Develop and maintain high-quality code for our core products.",
            "Collaborate with cross-functional teams to define and ship new features.",
            "Unit-test code for robustness, including edge cases, usability, and general reliability.",
            "Continuously discover, evaluate, and implement new technologies to maximize development efficiency."
        ],
        required_skills=["Java", "Spring Boot", "REST APIs", "SQL", "Git"]
    )

@app.post("/generate-screening")
def generate_screening(request: TestGenerationRequest):
    return {
        "questions": [
            {"id": "q1", "text": f"Basic question about {skill}", "options": ["A", "B", "C"], "answer": "A"}
            for skill in request.skills
        ]
    }

@app.post("/evaluate-screening")
def evaluate_screening(request: EvaluateScreeningRequest):
    return {"aiScore": 85.0}

@app.post("/generate-aptitude")
def generate_aptitude(request: TestGenerationRequest):
    return {
        "questions": [
            {"id": "a1", "text": "Logical reasoning test", "options": ["1", "2", "3"], "answer": "1"}
        ]
    }

@app.post("/evaluate-aptitude")
def evaluate_aptitude(request: EvaluateScreeningRequest):
    return {"aiScore": 80.0}

@app.post("/ai/analyze-coding")
def analyze_coding(request: AnalyzeCodingRequest) -> AnalyzeCodingResponse:
    # Simulating AI analysis
    return AnalyzeCodingResponse(
        aiScore=88,
        feedback={
            "complexity": "O(N)",
            "cleanliness": "Good architecture, clean variable naming.",
            "logical_correctness": "Corner cases handled, core logic is sound.",
            "edge_cases": "Handled correctly for empty inputs and large data sets."
        }
    )

# Keeping old endpoint for backward compatibility if any
@app.post("/analyze-coding")
def analyze_coding_v1(request: AnalyzeCodingRequest):
    return {
        "aiScore": 90.0,
        "feedback": {"complexity": "O(N)", "cleanliness": "Good architecture"}
    }

@app.post("/generate-technical-hr-kit")
def generate_technical_hr_kit(request: GenerateHRKitRequest):
    return {
        "rubric": [
            {"topic": "System Design", "max_score": 10},
            {"topic": "Problem Solving", "max_score": 10}
        ]
    }

@app.post("/generate-general-hr-kit")
def generate_general_hr_kit(request: GenerateHRKitRequest):
    return {
        "rubric": [
            {"topic": "Communication", "max_score": 10},
            {"topic": "Culture Fit", "max_score": 10}
        ]
    }

@app.post("/ai/compute-final-decision")
def compute_final_decision(request: ComputeDecisionRequest) -> ComputeDecisionResponse:
    if not request.stage_scores:
        raise HTTPException(status_code=400, detail="No scores provided")
    
    avg_stage = sum(request.stage_scores) / len(request.stage_scores)
    # Simple weighted score
    final_score = (avg_stage * 0.6) + (request.github_score * 0.2) + (request.linkedin_score * 0.2)
    
    recommendation = "HIRE"
    if final_score < 60:
        recommendation = "REJECT"
    elif final_score < 75:
        recommendation = "BORDERLINE"
        
    reasoning = [
        f"Strong performance in coding round with high technical marks.",
        f"Consistent interview feedback across {len(request.stage_scores)} rounds.",
        "Good GitHub presence showing active project contributions." if request.github_score > 70 else "Professional LinkedIn profile with relevant industry connections."
    ]
    
    return ComputeDecisionResponse(
        final_score=round(final_score, 2),
        confidence_index=round(final_score / 100.0, 2),
        recommendation=recommendation,
        reasoning=reasoning
    )

# Backward compatibility for compute-final-decision if needed
@app.post("/compute-final-decision")
def compute_final_decision_v1(request: Dict[str, Any]):
    # This matches the old signature if it was used with a dynamic Dict
    stage_scores = request.get("stage_scores", [70, 75, 80])
    avg_score = sum(stage_scores) / len(stage_scores)
    return {
        "final_score": avg_score,
        "confidence_index": avg_score / 100.0,
        "recommendation": "HIRE" if avg_score > 75 else "REJECT",
        "reasoning": ["Candidate achieved good average."]
    }

@app.post("/ai/analyze-profile")
async def analyze_profile(request: AnalyzeProfileRequest) -> AnalyzeProfileResponse:
    gh_score = 0
    li_score = 0
    detected_skills = []
    gh_sum = "No GitHub profile provided."
    li_sum = "No LinkedIn profile provided."
    
    if request.github_url:
        username = request.github_url.rstrip("/").split("/")[-1]
        user_data, repos = await get_github_data(username)
        
        if repos:
            repo_count = len(repos)
            stars = sum(r.get("stargazers_count", 0) for r in repos)
            languages = set()
            for r in repos:
                if r.get("language"):
                    languages.add(r.get("language"))
            
            repo_points = min(repo_count * 2, 40)
            star_points = min(stars * 5, 30)
            lang_points = min(len(languages) * 10, 30)
            
            gh_score = repo_points + star_points + lang_points
            detected_skills.extend(list(languages))
            gh_sum = f"Candidate '{username}' has {repo_count} public repositories with {stars} total stars. Primary languages: {', '.join(list(languages)[:5])}."
        else:
            gh_sum = f"GitHub profile found for '{username}', but no public repositories detected."
 
    if request.linkedin_url:
        li_score = random.randint(65, 85)
        li_sum = "LinkedIn profile indicates professional experience and industry engagement."
        if "Management" not in detected_skills:
            detected_skills.append("Management")

    detected_skills = list(set(detected_skills))
    
    return AnalyzeProfileResponse(
        github_score=int(gh_score),
        linkedin_score=int(li_score),
        detected_skills=detected_skills,
        github_summary=gh_sum,
        linkedin_summary=li_sum
    )

@app.post("/ai/generate-offer")
def generate_offer(request: OfferLetterRequest) -> OfferLetterResponse:
    role = request.role or request.job_title or "Software Engineer"
    content = f"""
OFFER OF EMPLOYMENT

Date: {request.joining_date}

Dear {request.candidate_name},

We are pleased to offer you the position of {role} at {request.company}. 

Your annual salary will be {request.salary}. We are excited to have you join our team and look forward to your contributions.

Sincerely,
HR Department, {request.company}
    """
    return OfferLetterResponse(offer_letter_content=content.strip())

@app.post("/ai/analyze-video")
async def analyze_video(
    file: UploadFile = File(...), 
    round_type: str = Form("Technical HR Interview")
) -> VideoAnalysisResponse:
    # Simulating Speech-to-Text and AI Summary & Recommendation Processing
    # Returning a realistic transcript mock dynamically based on the round
    
    technical_transcript = (
        "HR: Hi, thanks for joining. Can you walk me through your experience building scalable APIs?\\n"
        "Candidate: Sure, in my last project I used Spring Boot and Postgres. We structured our endpoints using REST principles, and optimized DB queries with indexing and caching via Redis to handle about 10k requests per second.\\n"
        "HR: That sounds solid. How did you handle security?\\n"
        "Candidate: We used OAuth2 with JWT tokens, and implemented role-based access control. I also configured global exception handlers to prevent sensitive data leaks in error messages.\\n"
        "HR: Excellent. And what about CI/CD?\\n"
        "Candidate: I setup GitHub Actions for automated unit testing and deployment. Once pushed to the main branch, a Docker image was built and deployed to our Kubernetes cluster."
    )
    
    general_transcript = (
        "HR: Tell me about a time you had to resolve a conflict within your team.\\n"
        "Candidate: Once, my team was split on choosing between a NoSQL and a Relational database for a new feature. I arranged a meeting to list the pros and cons based on our exact data needs, and we did a small proof of concept. The data drove our decision to stay with a relational DB, and the team was aligned.\\n"
        "HR: Great approach. Where do you see yourself in 3 years?\\n"
        "Candidate: I aim to be a Senior Developer driving architectural decisions and mentoring juniors, ensuring our products are built with high engineering standards.\\n"
        "HR: How do you handle tight deadlines?\\n"
        "Candidate: Prioritization is key. I break down tasks, focus on the MVP first, and keep stakeholders updated on progress."
    )
    
    transcript = technical_transcript if "tech" in round_type.lower() else general_transcript
    
    if "tech" in round_type.lower():
        summary = "Candidate demonstrated a very strong understanding of REST API design, database scaling strategies (Redis caching, indexing), and OAuth2 security patterns. The responses were articulate and backed by concrete examples of deploying via Docker and Kubernetes."
        recommendation = "HIRE"
        reasons = [
            "Clearly explained scalable API concepts using Spring Boot.",
            "Demonstrated hands-on experience with JWT security and CI/CD pipelines.",
            "Understands system architecture and DevOps principles."
        ]
    else:
        summary = "Candidate shows excellent soft skills, conflict resolution, and leadership potential. Approaches problems analytically by conducting POCs to align the team. Shows clear long-term career vision and good time-management strategies for tight deadlines."
        recommendation = "HIRE"
        reasons = [
            "Data-driven approach to resolving team conflicts.",
            "Strong communication and maturity in handling stakeholder expectations.",
            "Clear alignment with company culture and senior technical pathways."
        ]
        
    return VideoAnalysisResponse(
        transcript=transcript,
        summary=summary,
        recommendation=recommendation,
        reasons=reasons
    )
