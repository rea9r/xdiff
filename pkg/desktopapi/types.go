package desktopapi

type DiffCommon struct {
	OutputFormat     string   `json:"outputFormat"`
	TextStyle        string   `json:"textStyle"`
	IgnorePaths      []string `json:"ignorePaths"`
	IgnoreWhitespace bool     `json:"ignoreWhitespace"`
	IgnoreCase       bool     `json:"ignoreCase"`
	IgnoreEOL        bool     `json:"ignoreEOL"`
}

type DiffJSONValuesRequest struct {
	OldValue    string     `json:"oldValue"`
	NewValue    string     `json:"newValue"`
	Common      DiffCommon `json:"common"`
	IgnoreOrder bool       `json:"ignoreOrder"`
}

type DiffTextRequest struct {
	OldText string     `json:"oldText"`
	NewText string     `json:"newText"`
	Common  DiffCommon `json:"common"`
}

type LoadTextFileRequest struct {
	Path     string `json:"path"`
	Encoding string `json:"encoding,omitempty"`
}

type LoadTextFileResponse struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

type SaveTextFileRequest struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Encoding string `json:"encoding,omitempty"`
}

type SaveTextFileResponse struct {
	Path     string `json:"path"`
	Encoding string `json:"encoding"`
}

type DiffDirectoriesRequest struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	Recursive   bool   `json:"recursive"`
	ShowSame    bool   `json:"showSame"`
	NameFilter  string `json:"nameFilter"`
}

type DirectoryDiffSummary struct {
	Total        int `json:"total"`
	Same         int `json:"same"`
	Changed      int `json:"changed"`
	LeftOnly     int `json:"leftOnly"`
	RightOnly    int `json:"rightOnly"`
	TypeMismatch int `json:"typeMismatch"`
	Error        int `json:"error"`
}

type DirectoryDiffItem struct {
	Name         string `json:"name"`
	RelativePath string `json:"relativePath"`
	IsDir        bool   `json:"isDir"`
	Status       string `json:"status"`
	LeftPath     string `json:"leftPath"`
	RightPath    string `json:"rightPath"`
	LeftExists   bool   `json:"leftExists"`
	RightExists  bool   `json:"rightExists"`
	LeftKind     string `json:"leftKind"`
	RightKind    string `json:"rightKind"`
	LeftSize     int64  `json:"leftSize"`
	RightSize    int64  `json:"rightSize"`
	DiffModeHint string `json:"diffModeHint"`
	Message      string `json:"message,omitempty"`
}

type DiffDirectoriesResponse struct {
	CurrentPath    string               `json:"currentPath"`
	ParentPath     string               `json:"parentPath,omitempty"`
	ScannedSummary DirectoryDiffSummary `json:"scannedSummary"`
	CurrentSummary DirectoryDiffSummary `json:"currentSummary"`
	Items          []DirectoryDiffItem  `json:"items"`
	Error          string               `json:"error,omitempty"`
}

type DiffResponse struct {
	DiffFound bool   `json:"diffFound"`
	Output    string `json:"output"`
	Error     string `json:"error,omitempty"`
}

type JSONRichDiffItem struct {
	Type     string `json:"type"` // added | removed | changed | type_changed
	Path     string `json:"path"`
	OldValue any    `json:"oldValue,omitempty"`
	NewValue any    `json:"newValue,omitempty"`
}

type JSONRichSummary struct {
	Added       int `json:"added"`
	Removed     int `json:"removed"`
	Changed     int `json:"changed"`
	TypeChanged int `json:"typeChanged"`
}

type DiffJSONRichResponse struct {
	Result   DiffResponse       `json:"result"`
	DiffText string             `json:"diffText"`
	Summary  JSONRichSummary    `json:"summary"`
	Diffs    []JSONRichDiffItem `json:"diffs"`
}

type DesktopJSONSession struct {
	OldSourcePath string     `json:"oldSourcePath"`
	NewSourcePath string     `json:"newSourcePath"`
	IgnoreOrder   bool       `json:"ignoreOrder"`
	Common        DiffCommon `json:"common"`
}

type DesktopTextSession struct {
	OldSourcePath string     `json:"oldSourcePath"`
	NewSourcePath string     `json:"newSourcePath"`
	Common        DiffCommon `json:"common"`
	DiffLayout    string     `json:"diffLayout"`
}

type DesktopDirectorySession struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
}

type DesktopRecentPair struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
	UsedAt  string `json:"usedAt"`
}

type DesktopRecentDirectoryPair struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
	UsedAt      string `json:"usedAt"`
}

type DesktopTabSession struct {
	ID           string                  `json:"id"`
	Label        string                  `json:"label"`
	LastUsedMode string                  `json:"lastUsedMode"`
	JSON         DesktopJSONSession      `json:"json"`
	Text         DesktopTextSession      `json:"text"`
	Directory    DesktopDirectorySession `json:"directory"`
}

type DesktopState struct {
	Version              int                          `json:"version"`
	Tabs                 []DesktopTabSession          `json:"tabs"`
	ActiveTabID          string                       `json:"activeTabId"`
	JSONRecentPairs      []DesktopRecentPair          `json:"jsonRecentPairs"`
	TextRecentPairs      []DesktopRecentPair          `json:"textRecentPairs"`
	DirectoryRecentPairs []DesktopRecentDirectoryPair `json:"directoryRecentPairs"`
}

type ExplainDiffRequest struct {
	DiffText string `json:"diffText"`
	Mode     string `json:"mode"`
	Language string `json:"language,omitempty"`
	Model    string `json:"model,omitempty"`
}

type ExplainDiffStreamRequest struct {
	DiffText string `json:"diffText"`
	Mode     string `json:"mode"`
	Language string `json:"language,omitempty"`
	Model    string `json:"model,omitempty"`
	StreamID string `json:"streamId"`
}

type ExplainDiffResponse struct {
	Explanation string `json:"explanation"`
	Provider    string `json:"provider"`
	Model       string `json:"model"`
	Error       string `json:"error,omitempty"`
}

type AIProviderStatus struct {
	Available       bool     `json:"available"`
	Provider        string   `json:"provider,omitempty"`
	BaseURL         string   `json:"baseUrl,omitempty"`
	Models          []string `json:"models,omitempty"`
	Error           string   `json:"error,omitempty"`
	OllamaInstalled bool     `json:"ollamaInstalled"`
	OllamaReachable bool     `json:"ollamaReachable"`
	CanAutoStart    bool     `json:"canAutoStart"`
	HardwareTier    string   `json:"hardwareTier,omitempty"` // "low" | "mid" | "high" | ""
}

type AISetupRequest struct {
	Model string `json:"model,omitempty"`
}

type DeleteOllamaModelRequest struct {
	Model string `json:"model"`
}

type AISetupProgress struct {
	Phase         string  `json:"phase"`
	Message       string  `json:"message,omitempty"`
	Error         string  `json:"error,omitempty"`
	Model         string  `json:"model,omitempty"`
	PullCompleted int64   `json:"pullCompleted,omitempty"`
	PullTotal     int64   `json:"pullTotal,omitempty"`
	PullPercent   float64 `json:"pullPercent,omitempty"`
}

type DirectorySummaryItem struct {
	RelativePath string `json:"relativePath"`
	Status       string `json:"status"` // changed | left-only | right-only | type-mismatch | error
	LeftPath     string `json:"leftPath,omitempty"`
	RightPath    string `json:"rightPath,omitempty"`
	IsDir        bool   `json:"isDir"`
}

type DirectorySummaryRequest struct {
	Items       []DirectorySummaryItem `json:"items"`
	TotalBudget int                    `json:"totalBudget,omitempty"` // chars; default 12000
	PerFileCap  int                    `json:"perFileCap,omitempty"`  // chars; default 2000
	MaxFileSize int64                  `json:"maxFileSize,omitempty"` // bytes; default 256KiB
}

type DirectorySummarySkipped struct {
	Path   string `json:"path"`
	Reason string `json:"reason"` // too-large | binary | read-error | dir | type-mismatch
}

type DirectorySummaryResponse struct {
	Context        string                    `json:"context"`
	FilesIncluded  []string                  `json:"filesIncluded"`
	FilesOmitted   []string                  `json:"filesOmitted"` // changed but didn't fit budget
	FilesSkipped   []DirectorySummarySkipped `json:"filesSkipped"`
	TotalChanged   int                       `json:"totalChanged"`
	TotalLeftOnly  int                       `json:"totalLeftOnly"`
	TotalRightOnly int                       `json:"totalRightOnly"`
	BudgetUsed     int                       `json:"budgetUsed"`
	BudgetTotal    int                       `json:"budgetTotal"`
}
