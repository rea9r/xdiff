package desktopapi

type CompareCommon struct {
	FailOn       string   `json:"failOn"`
	OutputFormat string   `json:"outputFormat"`
	TextStyle    string   `json:"textStyle"`
	IgnorePaths  []string `json:"ignorePaths"`
	ShowPaths    bool     `json:"showPaths"`
	OnlyBreaking bool     `json:"onlyBreaking"`
	NoColor      bool     `json:"noColor"`
}

type CompareJSONRequest struct {
	OldPath     string        `json:"oldPath"`
	NewPath     string        `json:"newPath"`
	Common      CompareCommon `json:"common"`
	IgnoreOrder bool          `json:"ignoreOrder"`
}

type CompareSpecRequest struct {
	OldPath string        `json:"oldPath"`
	NewPath string        `json:"newPath"`
	Common  CompareCommon `json:"common"`
}

type CompareTextRequest struct {
	OldText string        `json:"oldText"`
	NewText string        `json:"newText"`
	Common  CompareCommon `json:"common"`
}

type LoadTextFileRequest struct {
	Path string `json:"path"`
}

type LoadTextFileResponse struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type CompareFoldersRequest struct {
	LeftRoot   string `json:"leftRoot"`
	RightRoot  string `json:"rightRoot"`
	Recursive  bool   `json:"recursive"`
	ShowSame   bool   `json:"showSame"`
	NameFilter string `json:"nameFilter"`
}

type FolderCompareSummary struct {
	Total        int `json:"total"`
	Same         int `json:"same"`
	Changed      int `json:"changed"`
	LeftOnly     int `json:"leftOnly"`
	RightOnly    int `json:"rightOnly"`
	TypeMismatch int `json:"typeMismatch"`
	Error        int `json:"error"`
}

type FolderCompareEntry struct {
	RelativePath    string `json:"relativePath"`
	Status          string `json:"status"`
	LeftPath        string `json:"leftPath"`
	RightPath       string `json:"rightPath"`
	LeftExists      bool   `json:"leftExists"`
	RightExists     bool   `json:"rightExists"`
	LeftKind        string `json:"leftKind"`
	RightKind       string `json:"rightKind"`
	LeftSize        int64  `json:"leftSize"`
	RightSize       int64  `json:"rightSize"`
	CompareModeHint string `json:"compareModeHint"`
	Message         string `json:"message,omitempty"`
}

type CompareFoldersResponse struct {
	Summary FolderCompareSummary `json:"summary"`
	Entries []FolderCompareEntry `json:"entries"`
	Error   string               `json:"error,omitempty"`
}

type RunScenarioRequest struct {
	ScenarioPath string   `json:"scenarioPath"`
	ReportFormat string   `json:"reportFormat"`
	Only         []string `json:"only"`
}

type ListScenarioChecksRequest struct {
	ScenarioPath string   `json:"scenarioPath"`
	ReportFormat string   `json:"reportFormat"`
	Only         []string `json:"only"`
}

type CompareResponse struct {
	ExitCode  int      `json:"exitCode"`
	DiffFound bool     `json:"diffFound"`
	Output    string   `json:"output"`
	Error     string   `json:"error,omitempty"`
	Paths     []string `json:"paths,omitempty"`
}

type ScenarioSummary struct {
	Total    int `json:"total"`
	OK       int `json:"ok"`
	Diff     int `json:"diff"`
	Error    int `json:"error"`
	ExitCode int `json:"exitCode"`
}

type ScenarioResult struct {
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Status       string `json:"status"`
	ExitCode     int    `json:"exitCode"`
	DiffFound    bool   `json:"diffFound"`
	Output       string `json:"output,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

type ScenarioRunResponse struct {
	ExitCode int              `json:"exitCode"`
	Summary  *ScenarioSummary `json:"summary,omitempty"`
	Results  []ScenarioResult `json:"results,omitempty"`
	Output   string           `json:"output,omitempty"`
	Error    string           `json:"error,omitempty"`
}

type ScenarioCheckListEntry struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Old     string `json:"old"`
	New     string `json:"new"`
	Summary string `json:"summary"`
}

type ScenarioListResponse struct {
	ExitCode int                      `json:"exitCode"`
	Checks   []ScenarioCheckListEntry `json:"checks,omitempty"`
	Output   string                   `json:"output,omitempty"`
	Error    string                   `json:"error,omitempty"`
}
