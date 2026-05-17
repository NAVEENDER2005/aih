import jsPDF from 'jspdf';

export function generateOfferLetter(candidateName: string, role: string, location: string = 'Chennai') {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    });

    // --- Colors & Fonts ---
    const primaryColor = '#4f46e5'; // Indigo
    const accentColor = '#8b5cf6';  // Violet
    const greyColor = '#9e9e9e';
    const textColor = '#333333';

    // Top left shapes matching professional style
    doc.setFillColor(accentColor);
    doc.triangle(0, 50, 40, 50, 0, 90, 'F');
    doc.setFillColor(greyColor);
    doc.triangle(0, 0, 70, 0, 0, 70, 'F');
    
    // Brand simulation
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("AI Hirer", 450, 60);
    doc.setFontSize(8);
    doc.setTextColor(accentColor);
    doc.text("Intelligent Recruitment Solutions", 432, 70);

    // Date
    const today = new Date();
    const formattedDate = `${today.getDate()}-${today.toLocaleString('default', { month: 'long' })}-${today.getFullYear()}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textColor);
    doc.text(formattedDate, 470, 90);

    // Reference Line
    const refDateStr = `AIH/${today.getFullYear().toString().substring(2)}/${role.replace(/ /g, '')}/${Math.floor(Math.random()*9000)+1000}`;
    doc.setFont("helvetica", "bold");
    doc.text(refDateStr, 50, 110);
    
    // Candidate Details
    doc.setFontSize(10);
    doc.text(`Mr./Ms. ${candidateName}`, 50, 130);
    doc.setFont("helvetica", "normal");
    doc.text(`${location},`, 50, 145);

    doc.setFont("helvetica", "bold");
    doc.text(`Dear ${candidateName},`, 50, 175);

    // Body Text Paragraph 1
    doc.setFont("helvetica", "normal");
    const p1 = `Thank you for your keen interest in joining our organization. Subsequent to our discussions with you, we are delighted to extend you an offer to join AI Hirer. We believe you can play an important role in our rapid growth and success, and look forward to welcoming you to the team.`;
    const p1Lines = doc.splitTextToSize(p1, 495);
    doc.text(p1Lines, 50, 200);

    // Body Text Paragraph 2
    doc.text(`At the time of joining, the following will be applicable:`, 50, 245);
    doc.setFont("helvetica", "bold");
    doc.text(`1. Designation : ${role}`, 80, 265);
    doc.text(`2. Tier               : Professional`, 80, 280);
    doc.text(`3. Track             : Technology`, 80, 295);

    doc.setFont("helvetica", "normal");
    doc.text(`Your date of joining would be ${formattedDate}.`, 50, 325);

    const p3 = `You will be based at our ${location} office. You will be on probation from your date of joining for a period of six months. You will continue to do so until the company confirms your services, in writing, based on your conduct and performance during this period meeting the standards of the Company. You would need to serve a notice period of two months during probation and three months on or after confirmation, in occasion of resignation from the services.`;
    const p3Lines = doc.splitTextToSize(p3, 495);
    doc.text(p3Lines, 50, 350);

    const p4 = `Your Total Remuneration will be ₹ ${Math.floor(Math.random() * (1200000 - 600000) + 600000).toLocaleString('en-IN')}/- per annum as per Annexure - I.`;
    const p4Lines = doc.splitTextToSize(p4, 495);
    doc.text(p4Lines, 50, 420);

    const p5 = `A summary explanation of the List of Benefits and the Basket of Allowances that can be chosen by you is attached. The Basket of Allowances feature gives you flexibility in structuring your compensation in a manner best suited to you.`;
    const p5Lines = doc.splitTextToSize(p5, 495);
    doc.text(p5Lines, 50, 450);

    const p6 = `Kindly sign the duplicate copy of this letter as a token of your acceptance of the Offer, and return it to the undersigned or representative on or before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}.`;
    const p6Lines = doc.splitTextToSize(p6, 495);
    doc.text(p6Lines, 50, 495);

    const p7 = `The Employee Service Agreement is also attached to this offer letter. You may read and sign the agreement and send it back to us along with your confirmation of the offer letter. Upon joining, you shall be signing "Employee Non-Disclosure Agreement" and other compliance related agreements with us.`;
    const p7Lines = doc.splitTextToSize(p7, 495);
    doc.text(p7Lines, 50, 535);

    doc.setFont("helvetica", "bold");
    doc.text(`Please note that the offer is valid subject to successful completion of your Background Verification.`, 50, 585);

    // Signatures Block
    doc.setFont("helvetica", "normal");
    doc.text(`Sincerely`, 50, 620);
    
    doc.setFontSize(8);
    // Left Side HR
    doc.setFont("helvetica", "bold");
    doc.text(`Hiring Manager`, 50, 680);
    doc.setFont("helvetica", "normal");
    doc.text(`Human Resource Department`, 50, 690);

    // Right Side Candidate Acceptance
    doc.setFont("helvetica", "normal");
    const rightSideText = `I hereby accept employment on the terms set forth\nin this letter as of this ____ day of ______________`;
    doc.text(rightSideText, 320, 620);

    doc.setFont("helvetica", "bold");
    doc.text(`${candidateName}`, 320, 680);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ________________`, 470, 680);

    // Footer lines
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(50, 780, 545, 780);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text(`AI Hirer Solutions`, 50, 792);
    
    doc.setFontSize(6);
    doc.setTextColor(greyColor);
    const footerLines = `Headquarters: Hitech City, Hyderabad, India\nT: +91 404 000 0000  |  www.ai-hirer.com\nTerms and Conditions Apply`;
    doc.text(footerLines, 50, 802);
    
    // Bottom border
    doc.setFillColor(accentColor);
    doc.rect(45, 830, 505, 5, 'F');
    doc.setFillColor(primaryColor);
    doc.rect(0, 830, 45, 5, 'F');

    return doc;
}

