/**
 * Strict FAQ Generator
 * Advanced text analysis engine for generating traceable FAQs
 * Uses TF-IDF scoring, sentence importance ranking, and key phrase extraction
 */

// ===================================
// CONFIGURATION
// ===================================
const CONFIG = {
    MIN_SENTENCES: 5,
    FAQ_COUNT: 5,
    MIN_SENTENCE_LENGTH: 20,
    STOP_WORDS: new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
        'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where',
        'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
        'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
        'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
    ]),
    QUESTION_PATTERNS: [
        { pattern: /^(.+?)\s+(?:is|are|was|were)\s+(.+)$/i, template: 'What {verb} {subject}?' },
        { pattern: /^(.+?)\s+(?:has|have|had)\s+(.+)$/i, template: 'What does {subject} have?' },
        { pattern: /^(.+?)\s+(?:can|could|may|might)\s+(.+)$/i, template: 'What can {subject} do?' },
        { pattern: /^(.+?)\s+(?:helps?|assists?|enables?|allows?)\s+(.+)$/i, template: 'How does {subject} help?' },
        { pattern: /^(.+?)\s+(?:causes?|leads?\s+to|results?\s+in)\s+(.+)$/i, template: 'What does {subject} cause?' },
        { pattern: /^(.+?)\s+(?:requires?|needs?)\s+(.+)$/i, template: 'What does {subject} require?' },
        { pattern: /^(.+?)\s+(?:provides?|offers?|gives?)\s+(.+)$/i, template: 'What does {subject} provide?' },
        { pattern: /^(.+?)\s+(?:includes?|contains?|consists?\s+of)\s+(.+)$/i, template: 'What does {subject} include?' }
    ],
    IMPORTANCE_INDICATORS: [
        'important', 'essential', 'critical', 'key', 'main', 'primary',
        'significant', 'major', 'fundamental', 'crucial', 'vital', 'necessary',
        'must', 'should', 'always', 'never', 'requires', 'ensures'
    ]
};

// ===================================
// DOM ELEMENTS
// ===================================
const elements = {
    sourceDocument: document.getElementById('sourceDocument'),
    charCount: document.getElementById('charCount'),
    reqLength: document.getElementById('reqLength'),
    generateBtn: document.getElementById('generateBtn'),
    outputSection: document.getElementById('outputSection'),
    faqGrid: document.getElementById('faqGrid'),
    emptyState: document.getElementById('emptyState'),
    highlightOverlay: document.getElementById('highlightOverlay'),
    copyAllBtn: document.getElementById('copyAllBtn'),
    exportBtn: document.getElementById('exportBtn'),
    toastContainer: document.getElementById('toastContainer'),
    // File upload elements
    fileDropZone: document.getElementById('fileDropZone'),
    fileInput: document.getElementById('fileInput'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    fileRemove: document.getElementById('fileRemove'),
    fileLoading: document.getElementById('fileLoading')
};

// ===================================
// STATE
// ===================================
let state = {
    sourceText: '',
    sentences: [],
    faqs: [],
    isGenerating: false,
    currentFile: null
};

// ===================================
// TEXT ANALYSIS ENGINE
// ===================================
class TextAnalyzer {
    constructor(text) {
        this.originalText = text;
        this.sentences = this.extractSentences(text);
        this.words = this.tokenize(text);
        this.termFrequency = this.calculateTF();
        this.idf = this.calculateIDF();
        this.tfidf = this.calculateTFIDF();
    }

    /**
     * Extract sentences from text using advanced splitting
     */
    extractSentences(text) {
        // Handle common abbreviations
        const preprocessed = text
            .replace(/Mr\./g, 'Mr')
            .replace(/Mrs\./g, 'Mrs')
            .replace(/Dr\./g, 'Dr')
            .replace(/Prof\./g, 'Prof')
            .replace(/etc\./g, 'etc')
            .replace(/e\.g\./g, 'eg')
            .replace(/i\.e\./g, 'ie')
            .replace(/vs\./g, 'vs');

        // Split on sentence boundaries
        const rawSentences = preprocessed.split(/(?<=[.!?])\s+(?=[A-Z])/);

        return rawSentences
            .map(s => s.trim())
            .filter(s => s.length >= CONFIG.MIN_SENTENCE_LENGTH)
            .map((sentence, index) => ({
                text: sentence,
                index,
                originalText: this.findOriginalSentence(text, sentence),
                words: this.tokenize(sentence),
                importance: 0
            }));
    }

    /**
     * Find the original sentence in the source text
     */
    findOriginalSentence(fullText, processedSentence) {
        // Try to find an exact match first
        const words = processedSentence.split(/\s+/).slice(0, 5).join('\\s+');
        const regex = new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const match = fullText.match(regex);

        if (match) {
            // Extract the full sentence from the original text
            const startIndex = match.index;
            const endMatch = fullText.slice(startIndex).match(/[.!?](?:\s|$)/);
            const endIndex = endMatch ? startIndex + endMatch.index + 1 : startIndex + processedSentence.length;
            return fullText.slice(startIndex, endIndex).trim();
        }

        return processedSentence;
    }

    /**
     * Tokenize text into words
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !CONFIG.STOP_WORDS.has(word));
    }

    /**
     * Calculate Term Frequency
     */
    calculateTF() {
        const tf = new Map();
        const totalWords = this.words.length;

        this.words.forEach(word => {
            tf.set(word, (tf.get(word) || 0) + 1);
        });

        // Normalize by total words
        tf.forEach((count, word) => {
            tf.set(word, count / totalWords);
        });

        return tf;
    }

    /**
     * Calculate Inverse Document Frequency
     */
    calculateIDF() {
        const idf = new Map();
        const numSentences = this.sentences.length;

        // Count sentences containing each word
        const sentenceCount = new Map();
        this.sentences.forEach(sentence => {
            const uniqueWords = new Set(sentence.words);
            uniqueWords.forEach(word => {
                sentenceCount.set(word, (sentenceCount.get(word) || 0) + 1);
            });
        });

        // Calculate IDF
        sentenceCount.forEach((count, word) => {
            idf.set(word, Math.log(numSentences / (1 + count)) + 1);
        });

        return idf;
    }

    /**
     * Calculate TF-IDF scores
     */
    calculateTFIDF() {
        const tfidf = new Map();

        this.termFrequency.forEach((tf, word) => {
            const idf = this.idf.get(word) || 1;
            tfidf.set(word, tf * idf);
        });

        return tfidf;
    }

    /**
     * Score sentence importance using multiple factors
     */
    scoreSentences() {
        this.sentences.forEach(sentence => {
            let score = 0;

            // 1. TF-IDF based score
            const tfidfScore = sentence.words.reduce((sum, word) => {
                return sum + (this.tfidf.get(word) || 0);
            }, 0) / Math.max(sentence.words.length, 1);
            score += tfidfScore * 3;

            // 2. Position bonus (first and last sentences often important)
            if (sentence.index < 2) score += 0.5;
            if (sentence.index >= this.sentences.length - 2) score += 0.3;

            // 3. Length bonus (not too short, not too long)
            const wordCount = sentence.words.length;
            if (wordCount >= 8 && wordCount <= 25) score += 0.4;

            // 4. Importance indicators
            const lowerText = sentence.text.toLowerCase();
            CONFIG.IMPORTANCE_INDICATORS.forEach(indicator => {
                if (lowerText.includes(indicator)) score += 0.5;
            });

            // 5. Contains numbers or percentages (often factual)
            if (/\d+%?/.test(sentence.text)) score += 0.4;

            // 6. Contains proper nouns (capitalized words mid-sentence)
            const properNouns = sentence.text.match(/(?<=\s)[A-Z][a-z]+/g);
            if (properNouns && properNouns.length > 0) score += 0.3;

            // 7. Definitive statements (contains "is", "are", definitions)
            if (/\b(?:is|are|refers to|means|defined as)\b/i.test(sentence.text)) {
                score += 0.5;
            }

            sentence.importance = score;
        });

        return this.sentences.sort((a, b) => b.importance - a.importance);
    }

    /**
     * Extract key phrases from text
     */
    extractKeyPhrases(sentence) {
        const text = sentence.text;
        const phrases = [];

        // Extract noun phrases (simplified)
        const nounPatterns = [
            /(?:the|a|an)\s+(?:\w+\s+)*\w+(?=\s+(?:is|are|was|were|has|have))/gi,
            /(?:^|\.\s+)([A-Z][a-z]+(?:\s+[a-z]+)*)/g
        ];

        nounPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) phrases.push(...matches);
        });

        return phrases.map(p => p.trim()).filter(p => p.length > 3);
    }
}

// ===================================
// FAQ GENERATOR
// ===================================
class FAQGenerator {
    constructor(analyzer) {
        this.analyzer = analyzer;
    }

    /**
     * Generate exactly 5 FAQs from the analyzed text
     */
    generate() {
        const scoredSentences = this.analyzer.scoreSentences();
        const faqs = [];
        const usedSentences = new Set();

        // Select top sentences ensuring diversity
        for (const sentence of scoredSentences) {
            if (faqs.length >= CONFIG.FAQ_COUNT) break;
            if (usedSentences.has(sentence.index)) continue;

            // Check similarity with already selected sentences
            if (this.isTooSimilar(sentence, Array.from(usedSentences).map(i =>
                scoredSentences.find(s => s.index === i)
            ).filter(Boolean))) {
                continue;
            }

            const faq = this.createFAQ(sentence, faqs.length + 1);
            if (faq) {
                faqs.push(faq);
                usedSentences.add(sentence.index);
            }
        }

        // If we don't have enough FAQs, be less strict
        if (faqs.length < CONFIG.FAQ_COUNT) {
            for (const sentence of scoredSentences) {
                if (faqs.length >= CONFIG.FAQ_COUNT) break;
                if (usedSentences.has(sentence.index)) continue;

                const faq = this.createFAQ(sentence, faqs.length + 1);
                if (faq) {
                    faqs.push(faq);
                    usedSentences.add(sentence.index);
                }
            }
        }

        return faqs;
    }

    /**
     * Check if a sentence is too similar to already selected ones
     */
    isTooSimilar(sentence, selectedSentences) {
        if (!selectedSentences.length) return false;

        for (const selected of selectedSentences) {
            if (!selected) continue;
            const similarity = this.calculateSimilarity(sentence.words, selected.words);
            if (similarity > 0.5) return true;
        }
        return false;
    }

    /**
     * Calculate Jaccard similarity between two word sets
     */
    calculateSimilarity(words1, words2) {
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    /**
     * Create a single FAQ from a sentence
     */
    createFAQ(sentence, number) {
        const question = this.generateQuestion(sentence);
        const answer = this.generateAnswer(sentence);
        const reference = sentence.originalText || sentence.text;

        if (!question || !answer) return null;

        return {
            number,
            question,
            answer,
            reference,
            sourceIndex: sentence.index
        };
    }

    /**
     * Generate a question from a declarative sentence
     */
    generateQuestion(sentence) {
        const text = sentence.text.replace(/[.!?]$/, '').trim();

        // Try pattern-based question generation
        for (const { pattern, template } of CONFIG.QUESTION_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                const subject = match[1].trim();
                const shortSubject = this.extractSubject(subject);

                // Generate contextual question
                return this.formatQuestion(text, shortSubject);
            }
        }

        // Fallback: Create a "What" question based on the main topic
        const subject = this.extractSubject(text);
        return `What is important to know about ${subject.toLowerCase()}?`;
    }

    /**
     * Extract the main subject from a sentence
     */
    extractSubject(text) {
        // Remove leading articles
        let subject = text.replace(/^(?:the|a|an)\s+/i, '');

        // Take first meaningful phrase
        const phrases = subject.split(/[,;:]/);
        subject = phrases[0].trim();

        // Limit length
        const words = subject.split(/\s+/);
        if (words.length > 5) {
            subject = words.slice(0, 5).join(' ');
        }

        return subject;
    }

    /**
     * Format a question based on sentence content
     */
    formatQuestion(text, subject) {
        const lowerText = text.toLowerCase();

        // Detect the type of information and generate appropriate question
        if (/\b(?:is|are|was|were)\s+(?:a|an|the)?\s*(?:type|kind|form|example)/i.test(text)) {
            return `What type is ${subject}?`;
        }

        if (/\bpercent|%|\b\d+\s*(?:times|percent|million|billion)/i.test(text)) {
            return `What is the quantity or percentage related to ${subject}?`;
        }

        if (/\b(?:causes?|leads?\s+to|results?\s+in)/i.test(text)) {
            return `What are the effects or results of ${subject}?`;
        }

        if (/\b(?:because|since|due\s+to|reason)/i.test(text)) {
            return `Why is ${subject} significant?`;
        }

        if (/\b(?:helps?|enables?|allows?|supports?)/i.test(text)) {
            return `How does ${subject} help or enable outcomes?`;
        }

        if (/\b(?:requires?|needs?|must|should)/i.test(text)) {
            return `What are the requirements for ${subject}?`;
        }

        if (/\b(?:includes?|contains?|consists?|comprises?)/i.test(text)) {
            return `What does ${subject} include or contain?`;
        }

        if (/\b(?:located|found|exists?|occurs?)/i.test(text)) {
            return `Where or when does ${subject} occur?`;
        }

        if (/\b(?:process|method|way|approach|technique)/i.test(text)) {
            return `What is the process or method for ${subject}?`;
        }

        // Default question format
        return `What should be known about ${subject}?`;
    }

    /**
     * Generate an answer strictly from the source sentence
     */
    generateAnswer(sentence) {
        // The answer is the original sentence - no modification to prevent hallucination
        return sentence.text;
    }
}

// ===================================
// FILE PARSER
// ===================================
class FileParser {
    /**
     * Parse a file and extract text content
     * Supports: TXT, PDF, DOCX, MD, JSON
     */
    static async parse(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        switch (extension) {
            case 'txt':
            case 'text':
            case 'md':
                return await this.parseTextFile(file);
            case 'pdf':
                return await this.parsePDF(file);
            case 'docx':
                return await this.parseDOCX(file);
            case 'json':
                return await this.parseJSON(file);
            default:
                throw new Error(`Unsupported file format: .${extension}`);
        }
    }

    /**
     * Parse plain text files (TXT, MD)
     */
    static async parseTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read text file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse PDF files using PDF.js
     */
    static async parsePDF(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded. Please check your internet connection.');
        }

        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText.trim();
    }

    /**
     * Parse DOCX files using Mammoth.js
     */
    static async parseDOCX(file) {
        if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth.js library not loaded. Please check your internet connection.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        if (result.messages.length > 0) {
            console.warn('DOCX parsing warnings:', result.messages);
        }

        return result.value;
    }

    /**
     * Parse JSON files (extracts text from string values)
     */
    static async parseJSON(file) {
        const text = await this.parseTextFile(file);
        const json = JSON.parse(text);

        // Extract all string values recursively
        const extractStrings = (obj) => {
            const strings = [];

            if (typeof obj === 'string') {
                strings.push(obj);
            } else if (Array.isArray(obj)) {
                obj.forEach(item => strings.push(...extractStrings(item)));
            } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(value => strings.push(...extractStrings(value)));
            }

            return strings;
        };

        return extractStrings(json).join('\n');
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// ===================================
// UI CONTROLLER
// ===================================
class UIController {
    constructor() {
        this.bindEvents();
        this.updateCharCount();
    }

    bindEvents() {
        // Source document input
        elements.sourceDocument.addEventListener('input', () => {
            this.updateCharCount();
            this.validateInput();
        });

        // Generate button
        elements.generateBtn.addEventListener('click', () => this.handleGenerate());

        // Action buttons
        elements.copyAllBtn.addEventListener('click', () => this.copyAllFAQs());
        elements.exportBtn.addEventListener('click', () => this.exportFAQs());

        // File upload events
        this.bindFileUploadEvents();
    }

    bindFileUploadEvents() {
        const dropZone = elements.fileDropZone;
        const fileInput = elements.fileInput;

        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag and drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // Remove file button
        elements.fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile();
        });
    }

    async handleFileUpload(file) {
        // Validate file type
        const validExtensions = ['txt', 'text', 'pdf', 'docx', 'md', 'json'];
        const extension = file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(extension)) {
            this.showToast(`Unsupported file type: .${extension}. Please use TXT, PDF, DOCX, MD, or JSON.`, 'error');
            return;
        }

        // Show loading state
        elements.fileDropZone.classList.add('hidden');
        elements.fileInfo.classList.add('hidden');
        elements.fileLoading.classList.remove('hidden');

        try {
            // Parse the file
            const text = await FileParser.parse(file);

            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in the file.');
            }

            // Update state
            state.currentFile = file;

            // Update textarea with extracted text
            elements.sourceDocument.value = text;
            this.updateCharCount();
            this.validateInput();

            // Show file info
            elements.fileName.textContent = file.name;
            elements.fileSize.textContent = FileParser.formatFileSize(file.size);

            elements.fileLoading.classList.add('hidden');
            elements.fileDropZone.classList.add('hidden');
            elements.fileInfo.classList.remove('hidden');

            this.showToast(`Successfully loaded: ${file.name}`, 'success');

        } catch (error) {
            console.error('File parsing error:', error);
            this.showToast(error.message || 'Failed to parse file.', 'error');

            // Reset to drop zone
            elements.fileLoading.classList.add('hidden');
            elements.fileDropZone.classList.remove('hidden');
            elements.fileInfo.classList.add('hidden');
        }

        // Reset file input
        elements.fileInput.value = '';
    }

    removeFile() {
        state.currentFile = null;
        elements.sourceDocument.value = '';

        elements.fileInfo.classList.add('hidden');
        elements.fileDropZone.classList.remove('hidden');

        this.updateCharCount();
        this.validateInput();

        this.showToast('File removed', 'info');
    }

    updateCharCount() {
        const count = elements.sourceDocument.value.length;
        elements.charCount.textContent = `${count.toLocaleString()} characters`;
    }

    validateInput() {
        const text = elements.sourceDocument.value.trim();
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length >= CONFIG.MIN_SENTENCE_LENGTH);
        const isValid = sentences.length >= CONFIG.MIN_SENTENCES;

        // Update requirement indicator
        if (isValid) {
            elements.reqLength.classList.add('met');
            elements.reqLength.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                ${sentences.length} sentences detected (minimum 5)
            `;
        } else {
            elements.reqLength.classList.remove('met');
            elements.reqLength.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                ${sentences.length} of 5 minimum sentences
            `;
        }

        elements.generateBtn.disabled = !isValid;
        return isValid;
    }

    async handleGenerate() {
        if (state.isGenerating || !this.validateInput()) return;

        state.isGenerating = true;
        state.sourceText = elements.sourceDocument.value.trim();

        // Update UI
        elements.generateBtn.classList.add('loading');
        elements.emptyState.classList.add('hidden');

        // Simulate brief processing for better UX
        await this.delay(300);

        try {
            // Analyze text
            const analyzer = new TextAnalyzer(state.sourceText);

            if (analyzer.sentences.length < CONFIG.MIN_SENTENCES) {
                throw new Error('Not enough valid sentences found in the document.');
            }

            // Generate FAQs
            const generator = new FAQGenerator(analyzer);
            state.faqs = generator.generate();

            if (state.faqs.length < CONFIG.FAQ_COUNT) {
                this.showToast(`Generated ${state.faqs.length} FAQs. Document may need more diverse content for ${CONFIG.FAQ_COUNT} FAQs.`, 'warning');
            }

            // Render FAQs
            this.renderFAQs();
            this.showToast('Successfully generated FAQs from source document!', 'success');

        } catch (error) {
            console.error('Generation error:', error);
            this.showToast(error.message || 'Failed to generate FAQs. Please check your input.', 'error');
        } finally {
            state.isGenerating = false;
            elements.generateBtn.classList.remove('loading');
        }
    }

    renderFAQs() {
        elements.faqGrid.innerHTML = '';
        elements.outputSection.classList.add('visible');

        state.faqs.forEach(faq => {
            const card = this.createFAQCard(faq);
            elements.faqGrid.appendChild(card);
        });

        // Initialize gradient follow effect for newly created cards
        reinitGradientFollowForCards();
    }

    createFAQCard(faq) {
        const card = document.createElement('div');
        card.className = 'faq-card';
        card.innerHTML = `
            <div class="faq-number">${faq.number}</div>
            <h3 class="faq-question">${this.escapeHtml(faq.question)}</h3>
            <p class="faq-answer">${this.escapeHtml(faq.answer)}</p>
            <div class="faq-reference">
                <div class="faq-reference-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                    Source Reference
                </div>
                <p class="faq-reference-text" data-reference="${this.escapeHtml(faq.reference)}">${this.escapeHtml(faq.reference)}</p>
            </div>
        `;

        // Add click handler for reference highlighting
        const refText = card.querySelector('.faq-reference-text');
        refText.addEventListener('click', () => this.highlightReference(faq.reference));

        return card;
    }

    highlightReference(reference) {
        const sourceText = elements.sourceDocument.value;
        const index = sourceText.indexOf(reference);

        if (index !== -1) {
            // Scroll to and select the reference in the textarea
            elements.sourceDocument.focus();
            elements.sourceDocument.setSelectionRange(index, index + reference.length);

            // Scroll the selection into view
            const lineHeight = 24;
            const charBeforeRef = sourceText.substring(0, index);
            const lineNumber = (charBeforeRef.match(/\n/g) || []).length;
            elements.sourceDocument.scrollTop = lineNumber * lineHeight;

            this.showToast('Reference highlighted in source document', 'success');
        }
    }

    copyAllFAQs() {
        if (!state.faqs.length) return;

        const text = state.faqs.map(faq =>
            `Q${faq.number}: ${faq.question}\n` +
            `A: ${faq.answer}\n` +
            `Reference: "${faq.reference}"\n`
        ).join('\n');

        navigator.clipboard.writeText(text).then(() => {
            this.showToast('All FAQs copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Failed to copy to clipboard', 'error');
        });
    }

    exportFAQs() {
        if (!state.faqs.length) return;

        const exportData = {
            generatedAt: new Date().toISOString(),
            sourceDocumentLength: state.sourceText.length,
            faqCount: state.faqs.length,
            faqs: state.faqs.map(faq => ({
                number: faq.number,
                question: faq.question,
                answer: faq.answer,
                reference: faq.reference
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faqs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('FAQs exported as JSON!', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>'
            : type === 'error'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

        toast.innerHTML = `${icon}<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ===================================
// INITIALIZE
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    new UIController();

    // Initialize gradient follow effect (mouse tracking)
    initGradientFollow();
});

// ===================================
// GRADIENT FOLLOW EFFECT
// ===================================
function initGradientFollow() {
    // Track mouse position globally
    document.addEventListener('mousemove', (e) => {
        // Update global CSS variables for page-wide effects
        document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
        document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
    });

    // Enhanced tracking for specific card elements with relative positioning
    const trackableElements = document.querySelectorAll('.glass-card, .faq-card, .file-drop-zone');

    trackableElements.forEach(element => {
        element.addEventListener('mousemove', (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            element.style.setProperty('--mouse-x', x + 'px');
            element.style.setProperty('--mouse-y', y + 'px');
        });

        element.addEventListener('mouseleave', () => {
            // Reset to center when mouse leaves
            element.style.setProperty('--mouse-x', '50%');
            element.style.setProperty('--mouse-y', '50%');
        });
    });
}

// Re-initialize gradient follow for dynamically added elements (FAQ cards)
function reinitGradientFollowForCards() {
    const faqCards = document.querySelectorAll('.faq-card');

    faqCards.forEach(card => {
        // Remove existing listeners by cloning (prevents duplicates)
        if (!card.dataset.gradientInit) {
            card.dataset.gradientInit = 'true';

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                card.style.setProperty('--mouse-x', x + 'px');
                card.style.setProperty('--mouse-y', y + 'px');
            });

            card.addEventListener('mouseleave', () => {
                card.style.setProperty('--mouse-x', '50%');
                card.style.setProperty('--mouse-y', '50%');
            });
        }
    });
}

// ===================================
// PARTICLE ANIMATION SYSTEM
// ===================================
class ParticleAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.animationId = null;

        // Configuration - Yellow/Gold color scheme
        this.config = {
            particleCount: 80,
            particleMinSize: 1,
            particleMaxSize: 3,
            particleSpeed: 0.3,
            lineDistance: 150,
            lineWidth: 0.5,
            particleColor: { r: 245, g: 158, b: 11 },     // Amber/Gold (#f59e0b)
            particleColor2: { r: 234, g: 179, b: 8 },     // Yellow (#eab308)
            lineColor: { r: 245, g: 158, b: 11 },         // Amber/Gold
            mouseInfluence: 0.02,
            glowIntensity: 0.7
        };

        this.init();
    }

    init() {
        this.resize();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];

        for (let i = 0; i < this.config.particleCount; i++) {
            const useSecondaryColor = Math.random() > 0.5;
            const color = useSecondaryColor ? this.config.particleColor2 : this.config.particleColor;

            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * (this.config.particleMaxSize - this.config.particleMinSize) + this.config.particleMinSize,
                speedX: (Math.random() - 0.5) * this.config.particleSpeed,
                speedY: (Math.random() - 0.5) * this.config.particleSpeed,
                color: color,
                opacity: Math.random() * 0.5 + 0.3,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    drawParticle(particle, time) {
        // Pulsing opacity effect
        const pulse = Math.sin(time * particle.pulseSpeed + particle.pulseOffset) * 0.2 + 0.8;
        const opacity = particle.opacity * pulse * this.config.glowIntensity;

        // Glow effect
        const gradient = this.ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size * 4
        );
        gradient.addColorStop(0, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity * 0.3})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size * 4, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Core particle
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity + 0.3})`;
        this.ctx.fill();
    }

    drawLines() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.config.lineDistance) {
                    const opacity = (1 - distance / this.config.lineDistance) * 0.3;

                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(${this.config.lineColor.r}, ${this.config.lineColor.g}, ${this.config.lineColor.b}, ${opacity})`;
                    this.ctx.lineWidth = this.config.lineWidth;
                    this.ctx.stroke();
                }
            }
        }
    }

    updateParticle(particle) {
        // Move particle
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Mouse interaction - gentle attraction/repulsion
        if (this.mouse.x !== null && this.mouse.y !== null) {
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                particle.x -= dx * force * this.config.mouseInfluence;
                particle.y -= dy * force * this.config.mouseInfluence;
            }
        }

        // Boundary wrapping
        if (particle.x < -10) particle.x = this.canvas.width + 10;
        if (particle.x > this.canvas.width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = this.canvas.height + 10;
        if (particle.y > this.canvas.height + 10) particle.y = -10;
    }

    animate() {
        const time = Date.now() * 0.001;

        // Clear canvas with fade effect for trails
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear completely for clean render
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connecting lines first (behind particles)
        this.drawLines();

        // Update and draw particles
        this.particles.forEach(particle => {
            this.updateParticle(particle);
            this.drawParticle(particle, time);
        });

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Initialize particle animation
document.addEventListener('DOMContentLoaded', () => {
    new ParticleAnimation('particleCanvas');
});
