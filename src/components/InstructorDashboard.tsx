import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  BookOpen, 
  Settings, 
  Trash2, 
  Plus, 
  Check, 
  AlertTriangle, 
  Users, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronLeft, 
  ArrowLeft,
  LogOut, 
  BookOpenCheck,
  Building,
  GraduationCap,
  Save,
  Sliders,
  Sparkles,
  ClipboardList,
  Flame,
  Info,
  Upload,
  Pencil,
  X
} from 'lucide-react';
import { apiService, BASE_URL } from '../services/apiService';
import { Course, Department, Program, MarksCategory, UnitItem, CourseStudent, InstructorCourse } from '../types';

interface InstructorDashboardProps {
  onLogout: () => void;
  instructorName?: string;
}

// Prefix generator for dynamic column naming based on category
export const getCategoryPrefix = (name: string): string => {
  if (name.toLowerCase().includes('assign')) return 'A';
  if (name.toLowerCase().includes('quiz')) return 'Q';
  if (name.toLowerCase().includes('session')) return 'Sess';
  if (name.toLowerCase().includes('mid')) return 'Mid';
  if (name.toLowerCase().includes('final')) return 'Final';
  if (name.toLowerCase().includes('project')) return 'Proj';
  if (name.toLowerCase().includes('present')) return 'Pres';
  if (name.toLowerCase().includes('participat')) return 'CP';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
};

// Precise score extractor returning 0 by default, ensuring no dummy data
export const getStudentMark = (student: CourseStudent, categoryName: string, unitNo: number, totalMarks: number): number => {
  if (student.marks && student.marks[`${categoryName}-${unitNo}`] !== undefined) {
    return student.marks[`${categoryName}-${unitNo}`];
  }
  return 0; // No dummy data, instructor must enter student marks
};

// Safe and accurate Iqra letter grade lookup
export const getLetterGrade = (marks: number): string => {
  if (marks >= 85) return 'A';
  if (marks >= 80) return 'A-';
  if (marks >= 75) return 'B+';
  if (marks >= 71) return 'B';
  if (marks >= 68) return 'B-';
  if (marks >= 64) return 'C+';
  if (marks >= 61) return 'C';
  if (marks >= 57) return 'C-';
  if (marks >= 53) return 'D+';
  if (marks >= 50) return 'D';
  return 'F';
};

// High-fidelity cell input with focus controls, constraint capping, and zero/fail red text styling
export function CellInput({
  initialValue,
  totalMarks,
  passing,
  rowIndex,
  colIndex,
  onSave
}: {
  initialValue: number;
  totalMarks: number;
  passing: number;
  rowIndex: number;
  colIndex: number;
  onSave: (val: number) => void;
}) {
  const [val, setVal] = useState<string>(initialValue.toString());

  useEffect(() => {
    setVal(initialValue.toString());
  }, [initialValue]);

  const handleBlur = () => {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > totalMarks) num = totalMarks; // cap score to max unit marks defined
    setVal(parseFloat(num.toFixed(1)).toString());
    onSave(parseFloat(num.toFixed(1)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const prevInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex - 1}"][data-col="${colIndex}"]`
        );
        if (prevInput) {
          prevInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const prevColInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`
        );
        if (prevColInput) {
          prevColInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextColInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
        );
        if (nextColInput) {
          nextColInput.focus();
        }
      }, 50);
    }
  };

  const currentScore = parseFloat(val) || 0;
  const isFailed = currentScore < passing || currentScore === 0;

  return (
    <input
      type="text"
      value={val}
      data-row={rowIndex}
      data-col={colIndex}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.target.select()}
      className={`w-12 px-1 py-0.5 text-center bg-transparent border-0 font-mono text-[11px] font-bold outline-none rounded transition-all focus:ring-2 focus:ring-indigo-400 focus:bg-indigo-50/70 ${
        isFailed ? 'text-rose-600 focus:text-rose-700' : 'text-blue-700'
      }`}
    />
  );
}



// Initial defaults to start entirely from scratch without pre-distributed dummy values.
const INITIAL_CATEGORIES: MarksCategory[] = [
  { name: 'Assignments', percentage: 0, units: 0 },
  { name: 'Quizzes', percentage: 0, units: 0 },
  { name: 'Class Participation', percentage: 0, units: 0 },
  { name: 'Class Project', percentage: 0, units: 0 },
  { name: 'Presentation', percentage: 0, units: 0 },
  { name: 'Lab Project', percentage: 0, units: 0 },
  { name: 'Sessionals', percentage: 0, units: 0 },
  { name: 'Mid Term', percentage: 0, units: 0 },
  { name: 'Final', percentage: 0, units: 0 },
];

const INITIAL_UNITS_DATA: Record<string, UnitItem[]> = {
  'Assignments': [],
  'Quizzes': [],
  'Sessionals': [],
  'Final': [],
};

export const DEPARTMENT_PROGRAMS: Record<string, { id: string; name: string }[]> = {
  computing: [
    { id: 'bscs', name: 'Bachelor of Science in Computer Science (BSCS)' },
    { id: 'bsse', name: 'Bachelor of Science in Software Engineering (BSSE)' },
    { id: 'bsai', name: 'Bachelor of Science in Artificial Intelligence (BSAI)' },
    { id: 'bsit', name: 'BS Information Technology (BSIT)' },
  ],
  business: [
    { id: 'bba', name: 'Bachelor of Business Administration (BBA)' },
    { id: 'mba', name: 'Master of Business Administration (MBA)' },
    { id: 'bsaf', name: 'BS Accounting & Finance (BSAF)' },
  ]
};

const DEFAULT_COURSES: InstructorCourse[] = [];

export default function InstructorDashboard({ onLogout, instructorName = 'Prof. Dr. Jameel Ahmed' }: InstructorDashboardProps) {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
    if (saved === 'course-1' || saved === 'course-2') return '';
    if (saved) return saved;
    return '';
  });

  // Load from API on mount, fallback offline if server not reachable
  useEffect(() => {
    let active = true;
    const fetchCourses = async () => {
      try {
        const data = await apiService.getInstructorCourses();
        if (active) {
          const filtered = data.filter(c => c.id !== 'course-1' && c.id !== 'course-2');
          setCourses(filtered);
          
          // Make sure an active course is selected if none currently chosen
          const savedActive = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
          if (!savedActive || savedActive === 'course-1' || savedActive === 'course-2') {
            if (filtered.length > 0) {
              setActiveCourseId(filtered[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load instructor courses", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchCourses();
    return () => {
      active = false;
    };
  }, []);

  // Keep state synced to local storage & backend
  useEffect(() => {
    localStorage.setItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID', activeCourseId);
  }, [activeCourseId]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(courses));
      apiService.saveInstructorCourses(courses).catch(err => {
        console.warn("Failed to sync instructor courses to backend", err);
      });
    }
  }, [courses, loading]);

  // UI state variables
  const [activeTab, setActiveTab] = useState<'weightage' | 'edit-items' | 'students' | 'grade' | 'marks-entry'>('weightage');
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseToDeleteId, setCourseToDeleteId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'about' | 'help' | null>(null);
  
  // Header scroll and hover triggers for autohiding the quick toolbar
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close the desktop menu when the user clicks anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Warning Modals and Alert triggers
  const [showZeroAlert, setShowZeroAlert] = useState<{ show: boolean; msg: string; category: string } | null>(null);
  const [unitEditingCategory, setUnitEditingCategory] = useState<string | null>(null);

  // Form states for creating course
  const [addDeptId, setAddDeptId] = useState('computing');
  const [addProgramId, setAddProgramId] = useState('bscs');
  const [addCourseCode, setAddCourseCode] = useState('');
  const [addCourseTitle, setAddCourseTitle] = useState('');
  const [addCreditHours, setAddCreditHours] = useState(3);

  // Form states for editing course
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editDeptId, setEditDeptId] = useState('computing');
  const [editProgramId, setEditProgramId] = useState('bscs');
  const [editCreditHours, setEditCreditHours] = useState(3);

  // Edit Student states
  const [editingStudentReg, setEditingStudentReg] = useState<string | null>(null);
  const [editStudentRegVal, setEditStudentRegVal] = useState<string>('');
  const [editStudentNameVal, setEditStudentNameVal] = useState<string>('');

  // Single Course context helper
  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === activeCourseId) || null;
  }, [courses, activeCourseId]);

  // --- Sub-modules: set Weightage States ---
  // A temporary copy of the selected course's categories for non-destructive updates before pressing "Ok" or "Save"
  const [tempCategories, setTempCategories] = useState<MarksCategory[]>([]);
  const [selectedWeightIndex, setSelectedWeightIndex] = useState<number>(0);

  // Form fields for updating a weight category under the table
  const [editWeightPercent, setEditWeightPercent] = useState<string>('0');
  const [editWeightUnits, setEditWeightUnits] = useState<string>('0');

  const previousCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedCourse) {
      setTempCategories(JSON.parse(JSON.stringify(selectedCourse.categories)));
      if (previousCourseIdRef.current !== selectedCourse.id) {
        setSelectedWeightIndex(0);
        previousCourseIdRef.current = selectedCourse.id;
      }
    } else {
      previousCourseIdRef.current = null;
    }
  }, [selectedCourse, activeTab]);

  // Load input fields when the selected index or category length updates
  useEffect(() => {
    if (tempCategories.length > 0 && tempCategories[selectedWeightIndex]) {
      setEditWeightPercent(tempCategories[selectedWeightIndex].percentage.toString());
      setEditWeightUnits(tempCategories[selectedWeightIndex].units.toString());
    }
  }, [selectedWeightIndex, tempCategories.length]);

  const handleWeightPercentChange = (valStr: string) => {
    setEditWeightPercent(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          percentage: val
        };
      }
      return copy;
    });
  };

  const handleWeightUnitsChange = (valStr: string) => {
    setEditWeightUnits(valStr);
    const parsed = parseInt(valStr, 10);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          units: val
        };
      }
      return copy;
    });
  };

  // Compute live totals
  const currentTotalWeight = useMemo(() => {
    return tempCategories.reduce((sum, item) => sum + item.percentage, 0);
  }, [tempCategories]);

  // --- Sub-modules: Set Units Modal States ---
  // Grid details for the currently active unit editing configuration
  const [tempUnits, setTempUnits] = useState<UnitItem[]>([]);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);
  const [unitTotalMarks, setUnitTotalMarks] = useState<string>('10');
  const [unitPassMarks, setUnitPassMarks] = useState<string>('5');
  const [unitWeightage, setUnitWeightage] = useState<string>('16');

  const handleUnitTotalMarksChange = (valStr: string) => {
    setUnitTotalMarks(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          totalMarks: val
        };
      }
      return copy;
    });
  };

  const handleUnitPassMarksChange = (valStr: string) => {
    setUnitPassMarks(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          passing: val
        };
      }
      return copy;
    });
  };

  const handleUnitWeightageChange = (valStr: string) => {
    setUnitWeightage(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          weightage: val
        };
      }
      return copy;
    });
  };

  // Triggered when opening a category from "Edit Items" dropdown or list
  const handleOpenUnitEditor = (categoryName: string) => {
    if (!selectedCourse) return;
    const cat = selectedCourse.categories.find(c => c.name === categoryName);
    if (!cat || cat.percentage === 0 || cat.units === 0) {
      // Pop up the screenshot-accurate Windows error dialog
      const realMsg = `Percentage is 0 (Zero), cannot add unit item for Marks Distribution ${categoryName}.`;
      setShowZeroAlert({
        show: true,
        msg: realMsg,
        category: categoryName
      });
      return;
    }

    // Load unit details
    const existingUnits = selectedCourse.unitsData[categoryName] || [];
    // Ensure accurate sizing to cat.units
    let actualUnits = [...existingUnits];
    if (actualUnits.length < cat.units) {
      const diff = cat.units - actualUnits.length;
      for (let i = 0; i < diff; i++) {
        const uNo = actualUnits.length + 1;
        const defaultW = Math.round(100 / cat.units);
        actualUnits.push({
          unitNo: uNo,
          passing: 5,
          totalMarks: 10,
          weightage: defaultW
        });
      }
    } else if (actualUnits.length > cat.units) {
      actualUnits = actualUnits.slice(0, cat.units);
    }

    setTempUnits(actualUnits);
    setSelectedUnitIndex(0);
    if (actualUnits[0]) {
      setUnitTotalMarks(actualUnits[0].totalMarks.toString());
      setUnitPassMarks(actualUnits[0].passing.toString());
      setUnitWeightage(actualUnits[0].weightage.toString());
    }
    setUnitEditingCategory(categoryName);
  };

  useEffect(() => {
    if (tempUnits.length > 0 && tempUnits[selectedUnitIndex]) {
      setUnitTotalMarks(tempUnits[selectedUnitIndex].totalMarks.toString());
      setUnitPassMarks(tempUnits[selectedUnitIndex].passing.toString());
      setUnitWeightage(tempUnits[selectedUnitIndex].weightage.toString());
    }
  }, [selectedUnitIndex, tempUnits.length]);

  // Calculate sum of unit weightages (should ideally sum to 100% of the category total weight)
  const totalUnitWeightSum = useMemo(() => {
    return tempUnits.reduce((sum, u) => sum + u.weightage, 0);
  }, [tempUnits]);

  // --- Sub-modules: Students Setup States ---
  const [newStudentReg, setNewStudentReg] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkRegText, setBulkRegText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsedStudents, setParsedStudents] = useState<CourseStudent[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Course management action callbacks
  const handleAddNewCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCourseCode || !addCourseTitle) return;

    const deptName = addDeptId === 'computing' 
      ? 'Department of Computing and Technology' 
      : 'Department of Business Administration';

    const programObj = DEPARTMENT_PROGRAMS[addDeptId]?.find(p => p.id === addProgramId);

    const newCourse: InstructorCourse = {
      id: `course-${Date.now()}`,
      code: addCourseCode.toUpperCase().trim(),
      title: addCourseTitle.trim(),
      departmentId: addDeptId,
      departmentName: deptName,
      programId: addProgramId,
      programName: programObj ? programObj.name : undefined,
      creditHours: addCreditHours,
      categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
      unitsData: JSON.parse(JSON.stringify(INITIAL_UNITS_DATA)),
      students: [],
    };

    setCourses(prev => [...prev, newCourse]);
    setActiveCourseId(newCourse.id);
    setIsAddingCourse(false);
    setAddCourseCode('');
    setAddCourseTitle('');
    setActiveTab('weightage');
  };

  const handleOpenEditCourse = (course: InstructorCourse) => {
    setEditCourseCode(course.code);
    setEditCourseTitle(course.title);
    setEditDeptId(course.departmentId);
    setEditProgramId(course.programId || (course.departmentId === 'computing' ? 'bscs' : 'bba'));
    setEditCreditHours(course.creditHours);
    setIsEditingCourse(true);
  };

  const handleUpdateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourseCode || !editCourseTitle) return;

    const deptName = editDeptId === 'computing' 
      ? 'Department of Computing and Technology' 
      : 'Department of Business Administration';

    const programObj = DEPARTMENT_PROGRAMS[editDeptId]?.find(p => p.id === editProgramId);

    setCourses(prev => prev.map(c => {
      if (c.id === activeCourseId) {
        return {
          ...c,
          code: editCourseCode.toUpperCase().trim(),
          title: editCourseTitle.trim(),
          departmentId: editDeptId,
          departmentName: deptName,
          programId: editProgramId,
          programName: programObj ? programObj.name : undefined,
          creditHours: editCreditHours
        };
      }
      return c;
    }));

    setIsEditingCourse(false);
    setSuccessMsg('Course specification updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteCourse = (courseId: string) => {
    setCourseToDeleteId(courseId);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDeleteId) return;
    const remaining = courses.filter(c => c.id !== courseToDeleteId);
    setCourses(remaining);
    if (activeCourseId === courseToDeleteId) {
      setActiveCourseId(remaining[0]?.id || '');
    }
    setCourseToDeleteId(null);
    setSuccessMsg('Course specification deleted successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Weightage updates
  const handleUpdateCategorySingle = () => {
    const valPct = parseFloat(editWeightPercent) || 0;
    const valUnits = parseInt(editWeightUnits, 10) || 0;

    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          percentage: valPct,
          units: valUnits
        };
      }
      return copy;
    });
  };

  const handleSaveAllWeightage = () => {
    if (!selectedCourse) return;
    if (currentTotalWeight !== 100) {
      alert(`Invalid parameters: Total weight must exactly sum to 100.00%. Current: ${currentTotalWeight}%`);
      return;
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        // Build updated unitsData to make sure any changed units counts are matched nicely
        const updatedUnitsData = { ...c.unitsData };
        tempCategories.forEach(cat => {
          const currentList = updatedUnitsData[cat.name] || [];
          if (cat.units > currentList.length) {
            // Need to grow
            const diff = cat.units - currentList.length;
            const updatedList = [...currentList];
            for (let i = 0; i < diff; i++) {
              const uNo = updatedList.length + 1;
              const defaultW = Math.round(100 / cat.units);
              updatedList.push({
                unitNo: uNo,
                passing: 5,
                totalMarks: 10,
                weightage: defaultW
              });
            }
            updatedUnitsData[cat.name] = updatedList;
          } else if (cat.units < currentList.length) {
            // Shrink
            updatedUnitsData[cat.name] = currentList.slice(0, cat.units);
          }
        });

        return {
          ...c,
          categories: tempCategories,
          unitsData: updatedUnitsData
        };
      }
      return c;
    }));

    setSuccessMsg('Weightage configuration updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleResetWeightage = () => {
    if (selectedCourse) {
      setTempCategories(JSON.parse(JSON.stringify(selectedCourse.categories)));
    }
  };

  // Unit category save/updates
  const handleUpdateUnitSingle = () => {
    const tot = parseFloat(unitTotalMarks) || 10;
    const pass = parseFloat(unitPassMarks) || 5;
    const weight = parseFloat(unitWeightage) || 0;

    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          totalMarks: tot,
          passing: pass,
          weightage: weight
        };
      }
      return copy;
    });
  };

  const handleAddUnitRow = () => {
    const nextNo = tempUnits.length + 1;
    setTempUnits(prev => [
      ...prev,
      {
        unitNo: nextNo,
        passing: 5,
        totalMarks: 10,
        weightage: 10
      }
    ]);
    setSelectedUnitIndex(tempUnits.length);
  };

  const handleRemoveUnitRow = () => {
    if (tempUnits.length <= 1) {
      alert("At least 1 unit is required.");
      return;
    }
    setTempUnits(prev => prev.slice(0, prev.length - 1));
    setSelectedUnitIndex(Math.max(0, tempUnits.length - 2));
  };

  const handleSaveUnitSettings = () => {
    if (!selectedCourse || !unitEditingCategory) return;

    // Dynamically update tempCategories too, so the change appears instantly in the set weightage section
    setTempCategories(prev => prev.map(cat => {
      if (cat.name === unitEditingCategory) {
        return {
          ...cat,
          units: tempUnits.length
        };
      }
      return cat;
    }));

    // Update both the specific category count and the unit objects
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const copyCats = c.categories.map(cat => {
          if (cat.name === unitEditingCategory) {
            return {
              ...cat,
              units: tempUnits.length
            };
          }
          return cat;
        });

        const copyUnitsData = {
          ...c.unitsData,
          [unitEditingCategory]: tempUnits
        };

        return {
          ...c,
          categories: copyCats,
          unitsData: copyUnitsData
        };
      }
      return c;
    }));

    setUnitEditingCategory(null);
    setSuccessMsg(`Units configuration defined for ${unitEditingCategory}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Students administration
  const handleAddNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newStudentReg) return;

    const stdName = newStudentName.trim() || `Student ${selectedCourse.students.length + 1}`;
    const cleanReg = newStudentReg.toUpperCase().trim();

    // Check duplicate
    if (selectedCourse.students.some(s => s.regNo === cleanReg)) {
      alert(`Student with registration number "${cleanReg}" already enrolled!`);
      return;
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: [...c.students, { regNo: cleanReg, name: stdName }]
        };
      }
      return c;
    }));

    setNewStudentReg('');
    setNewStudentName('');
  };

  // Clear students
  const handleUnenrollStudent = (reg: string) => {
    if (!selectedCourse) return;
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.filter(s => s.regNo !== reg)
        };
      }
      return c;
    }));
  };

  const handleStartEditStudent = (student: CourseStudent) => {
    setEditingStudentReg(student.regNo);
    setEditStudentRegVal(student.regNo);
    setEditStudentNameVal(student.name);
  };

  const handleCancelEditStudent = () => {
    setEditingStudentReg(null);
    setEditStudentRegVal('');
    setEditStudentNameVal('');
  };

  const handleUpdateStudentDetail = (oldRegNo: string) => {
    if (!selectedCourse) return;

    const cleanNewRegNo = editStudentRegVal.trim().toUpperCase();
    const cleanNewName = editStudentNameVal.trim();

    if (!cleanNewRegNo) {
      alert("Registration number cannot be empty!");
      return;
    }
    if (!cleanNewName) {
      alert("Student name cannot be empty!");
      return;
    }

    // Check duplication if they changed registration number
    if (cleanNewRegNo !== oldRegNo) {
      const exists = selectedCourse.students.some(s => s.regNo === cleanNewRegNo);
      if (exists) {
        alert(`Student with registration number "${cleanNewRegNo}" already exists!`);
        return;
      }
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.regNo === oldRegNo) {
              return {
                ...s,
                regNo: cleanNewRegNo,
                name: cleanNewName
              };
            }
            return s;
          })
        };
      }
      return c;
    }));

    setEditingStudentReg(null);
    setEditStudentRegVal('');
    setEditStudentNameVal('');
  };

  // Excel / CSV File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays representing rows
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        const list: CourseStudent[] = [];
        
        rows.forEach((row) => {
          if (!row || row.length < 1) return;
          
          let regRaw = row[0];
          let nameRaw = row[1];
          
          if (regRaw === undefined || regRaw === null) return;
          
          const r = String(regRaw).trim().toUpperCase();
          const n = nameRaw !== undefined && nameRaw !== null ? String(nameRaw).trim() : '';

          // Skip empty or header rows
          if (!r) return;
          const lowerR = r.toLowerCase();
          if (
            lowerR.includes("reg no") || 
            lowerR.includes("reg. no") || 
            lowerR.includes("roll no") || 
            lowerR.includes("roll_no") || 
            lowerR.includes("registration") ||
            lowerR.includes("reg_no") ||
            lowerR.includes("regid") ||
            lowerR.includes("id")
          ) {
            return;
          }

          list.push({
            regNo: r,
            name: n || `Enrolled Student ${r.split('-').pop() || ''}`
          });
        });

        if (list.length === 0) {
          alert("No valid student records could be parsed. Ensure Column 1 has the Registration Number and Column 2 has the Student Name.");
          setParsedStudents([]);
        } else {
          setParsedStudents(list);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse sheet. Please ensure it is a valid Excel (.xlsx, .xls) or CSV template file.");
        setParsedStudents([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        parseExcelFile(file);
      } else {
        alert("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      }
    }
  };

  const handleExcelImportExecute = () => {
    if (!selectedCourse || parsedStudents.length === 0) return;

    const addedList: CourseStudent[] = [];
    parsedStudents.forEach(item => {
      // Avoid duplicate enrollment within the course
      if (!selectedCourse.students.some(s => s.regNo === item.regNo) && !addedList.some(s => s.regNo === item.regNo)) {
        addedList.push(item);
      }
    });

    if (addedList.length === 0) {
      alert("All parsed student registration numbers from the Excel sheet are already enrolled in this course.");
      return;
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: [...c.students, ...addedList]
        };
      }
      return c;
    }));

    const count = addedList.length;
    setParsedStudents([]);
    setFileName('');
    setSuccessMsg(`Successfully imported ${count} students from sheet.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleUpdateStudentMark = (studentRegNo: string, categoryName: string, unitNo: number, score: number) => {
    if (!selectedCourse) return;
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.regNo === studentRegNo) {
              return {
                ...s,
                marks: {
                  ...(s.marks || {}),
                  [`${categoryName}-${unitNo}`]: score
                }
              };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  const tableColumns = useMemo(() => {
    if (!selectedCourse) return [];
    const cols: { categoryName: string; unitNo: number; totalMarks: number; passing: number; label: string }[] = [];
    
    selectedCourse.categories.forEach(cat => {
      if (cat.percentage > 0 && cat.units > 0) {
        const existingUnits = selectedCourse.unitsData[cat.name] || [];
        const prefix = getCategoryPrefix(cat.name);
        
        for (let u = 1; u <= cat.units; u++) {
          const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
          const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
          const passing = matchingUnit ? matchingUnit.passing : 5;
          
          cols.push({
            categoryName: cat.name,
            unitNo: u,
            totalMarks,
            passing,
            label: `${prefix}${u}`
          });
        }
      }
    });
    
    return cols;
  }, [selectedCourse]);

  const calculateStudentCourseTotal = (student: CourseStudent) => {
    if (!selectedCourse) return 0;
    let aggregate = 0;
    
    selectedCourse.categories.forEach(cat => {
      if (cat.percentage > 0) {
        if (cat.units > 0) {
          let catSum = 0;
          const existingUnits = selectedCourse.unitsData[cat.name] || [];
          
          for (let u = 1; u <= cat.units; u++) {
            const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
            const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
            const weightage = matchingUnit ? matchingUnit.weightage : (100 / cat.units);
            
            const mark = getStudentMark(student, cat.name, u, totalMarks);
            if (totalMarks > 0) {
              catSum += (mark / totalMarks) * weightage;
            }
          }
          
          const categoryContribution = (catSum / 100) * cat.percentage;
          aggregate += categoryContribution;
        } else {
          aggregate += 0;
        }
      }
    });
    
    return parseFloat(aggregate.toFixed(1));
  };

  const handleExportCourseSheet = () => {
    if (!selectedCourse) return;

    const csvRows: string[][] = [];

    // Header info matching core course details
    csvRows.push([`Course Title:`, selectedCourse.title]);
    csvRows.push([`Course Code:`, selectedCourse.code]);
    csvRows.push([`Instructor:`, instructorName]);
    csvRows.push([`Credit Hours:`, `${selectedCourse.creditHours}-0-${selectedCourse.creditHours}`]);
    csvRows.push([`Semester:`, `Sp-2026`]);
    csvRows.push([`Section:`, `All`]);
    csvRows.push([]); // spacer line

    // Table Header
    const headers = ['S.#', 'Registration No.', 'Student Name'];
    tableColumns.forEach(col => {
      headers.push(`${col.label} (Max ${col.totalMarks})`);
    });
    headers.push('TMarks', 'Grade');
    csvRows.push(headers);

    // Table Data row by row
    selectedCourse.students.forEach((std, idx) => {
      const row: string[] = [String(idx + 1), std.regNo, std.name];
      tableColumns.forEach(col => {
        const markVal = getStudentMark(std, col.categoryName, col.unitNo, col.totalMarks);
        row.push(String(markVal));
      });
      const tMarks = calculateStudentCourseTotal(std);
      const grade = getLetterGrade(tMarks);
      row.push(String(tMarks), grade);
      csvRows.push(row);
    });

    // Add Average Row if students exist
    if (selectedCourse.students.length > 0) {
      const stdCount = selectedCourse.students.length;
      const colAverages = tableColumns.map(col => {
        const sum = selectedCourse.students.reduce((acc, s) => {
          return acc + getStudentMark(s, col.categoryName, col.unitNo, col.totalMarks);
        }, 0);
        return (sum / stdCount).toFixed(2);
      });

      const tMarksAverage = (selectedCourse.students.reduce((acc, s) => {
        return acc + calculateStudentCourseTotal(s);
      }, 0) / stdCount).toFixed(2);

      const averageRow: string[] = ['F1', 'Average', 'Class Outcome Average'];
      colAverages.forEach(avg => {
        averageRow.push(avg);
      });
      averageRow.push(tMarksAverage, '-');
      csvRows.push(averageRow);
    }

    const csvContent = csvRows
      .map(row => row.map(val => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create clean file name matching the name of the course
    const fileName = `${selectedCourse.code} - ${selectedCourse.title}.csv`.replace(/[/\\?%*:|"<>]+/g, '_');
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans frosted-bg text-slate-800">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg">U</div>
          <p className="text-sm font-sans font-semibold text-indigo-950 animate-pulse">Loading course data from backend API...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans frosted-bg text-slate-800">
      
      {/* CLASSIC DESKTOP WINDOWS-STYLE MENU BAR HEADER */}
      <header 
        id="instructor-portal-header" 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        className="bg-[#f1f5f9] border-[#cbd5e1] border-b shrink-0 sticky top-0 z-40 select-none relative"
      >
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-1.5 max-w-[1700px]">
          
          {/* Menu items list */}
          <div className="flex flex-wrap items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            
            {/* BACK TO LOGIN */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-sans font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-200 rounded cursor-pointer transition-all mr-2.5 border-r border-slate-300 pr-3.5"
              title="Back to login selection"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Back</span>
            </button>

            {/* FILE MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
                onMouseEnter={() => openMenu && setOpenMenu('file')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'file' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                File
              </button>
              {openMenu === 'file' && (
                <div className="absolute left-0 mt-1 w-60 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={() => { setIsAddingCourse(true); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Add Course Teaches</span>
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={() => { onLogout(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Sign out / Logout</span>
                  </button>
                </div>
              )}
            </div>

            {/* SET WEIGHTAGE DIRECT ITEM */}
            <div className="relative">
              <button
                onClick={() => { setActiveTab('weightage'); setOpenMenu(null); }}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${activeTab === 'weightage' ? 'bg-slate-200 text-indigo-955 font-bold' : ''}`}
              >
                Set Weightage
              </button>
            </div>

            {/* EDIT ITEMS DROP DOWN */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveTab('edit-items');
                  setOpenMenu(openMenu === 'edit-items' ? null : 'edit-items');
                }}
                onMouseEnter={() => {
                  if (openMenu) {
                    setOpenMenu('edit-items');
                    setActiveTab('edit-items');
                  }
                }}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'edit-items' || activeTab === 'edit-items' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                Edit Items
              </button>
              {openMenu === 'edit-items' && selectedCourse && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 max-h-96 overflow-y-auto font-sans">
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Assessment Components
                  </div>
                  {selectedCourse.categories.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => { 
                        handleOpenUnitEditor(cat.name); 
                        setActiveTab('edit-items');
                        setOpenMenu(null); 
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ENTER MARKS SYSTEM */}
            <div className="relative font-bold">
              <button
                onClick={() => { setActiveTab('marks-entry'); setOpenMenu(null); }}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${activeTab === 'marks-entry' ? 'bg-slate-200 text-indigo-955 font-bold' : ''}`}
              >
                Enter Marks
              </button>
            </div>


            {/* REGISTERED ROSTER */}
            <div className="relative">
              <button
                onClick={() => { setActiveTab('students'); setOpenMenu(null); }}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${activeTab === 'students' ? 'bg-slate-200 text-indigo-955 font-bold' : ''}`}
              >
                Add Student
              </button>
            </div>

            {/* REPORTS MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'reports' ? null : 'reports')}
                onMouseEnter={() => openMenu && setOpenMenu('reports')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'reports' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                Reports
              </button>
              {openMenu === 'reports' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={() => { 
                      handleExportCourseSheet();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Export Marks Ledger (Excel)</span>
                  </button>
                  <button
                    onClick={() => { window.print(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Print Outcome Evaluation Report</span>
                  </button>
                </div>
              )}
            </div>

            {/* ABOUT */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'about' ? null : 'about')}
                onMouseEnter={() => openMenu && setOpenMenu('about')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-755 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'about' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                About
              </button>
              {openMenu === 'about' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1.5 z-50">
                  <button
                    onClick={() => { setActiveModal('about'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>About ResultMate Instructor Area</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Quick status display */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono tracking-tight font-semibold hidden sm:inline">
              User: <strong className="text-indigo-950 font-extrabold">{selectedCourse ? selectedCourse.departmentName : 'Department of Computing and Technology'} Instructor</strong>
            </span>
          </div>

        </div>

        {/* Quick Toolbar (Desktop Icon Bar styled) */}
        <div 
          className={`bg-[#f8fafc] px-6 flex flex-wrap items-center justify-between gap-4 select-none transition-all duration-300 ease-in-out ${
            (!isScrolled || isHeaderHovered)
              ? 'max-h-[120px] opacity-100 py-2 border-t border-slate-200'
              : 'max-h-0 opacity-0 py-0 border-t-0 overflow-hidden pointer-events-none'
          }`}
        >
          
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Quick Dept Selector */}
            <div className="flex items-center gap-2 bg-slate-100/70 border border-slate-200 px-3 py-1 rounded-lg animate-fade-in">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">DEPARTMENT:</span>
              <span className="text-slate-800 text-xs font-bold font-sans">
                {selectedCourse ? selectedCourse.departmentName : 'Department of Computing and Technology'}
              </span>
            </div>

            {/* Quick Course Selector */}
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 border border-slate-300 rounded-lg shadow-xs">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">COURSE:</span>
              <select
                value={activeCourseId}
                onChange={(e) => {
                  setActiveCourseId(e.target.value);
                  setUnitEditingCategory(null);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-bold font-sans focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Course teaches --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title} {c.programId ? `(${c.programId.toUpperCase()})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Educational Program details */}
            {selectedCourse && selectedCourse.programName && (
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-250 px-3 py-1 rounded-lg animate-fade-in">
                <span className="text-[9px] text-sky-900 font-bold tracking-wide uppercase">PROGRAM:</span>
                <span className="text-slate-800 text-xs font-bold font-sans">
                  {selectedCourse.programName}
                </span>
              </div>
            )}





          </div>

          {/* Right side course lock / configurations */}
          <div className="flex items-center gap-3">
            {selectedCourse && (
              <button
                onClick={() => handleDeleteCourse(selectedCourse.id)}
                className="text-rose-600 hover:text-rose-800 font-bold text-[10px] uppercase tracking-wider px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                title="Remove course specification"
              >
                Delete Specification
              </button>
            )}

            <button
              onClick={() => setIsAddingCourse(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wider rounded-lg transition-all shadow-xs shrink-0 font-sans"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add CourseTeaches</span>
            </button>
            
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-xs hover:border-slate-400 shrink-0 font-sans"
            >
              <LogOut className="w-3 h-3 text-slate-500" />
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* MAIN LAYOUT CANVAS */}
      <main className="grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {successMsg && (
          <div className="bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in duration-200 text-sm">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Empty State Banner */}
        {courses.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 p-12 rounded-3xl text-center max-w-md mx-auto my-12 shadow-sm font-sans">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Courses Enrolled</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              You are currently not teaching any course specifications. Click the button below to register a subject and start setting outcomes.
            </p>
            <button
              onClick={() => setIsAddingCourse(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Add Your First Course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
            
            {/* LEFT COLUMN: ACTIVE COURSE BOARD WITH DEPARTMENT GROUPING & SWITCHING & EASY EDIT/DELETE */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600 shrink-0" />
                  Courses Teaches
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Click a module to switch active context. One instructor can teach across different departments seamlessly.
                </p>
              </div>

              {/* DEPARTMENT: COMPUTING & TECH */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 border-b border-indigo-100 pb-1">
                  <span className="w-1.5 h-3 rounded bg-indigo-600 shrink-0"></span>
                  <span className="text-[9px] font-extrabold text-indigo-950 uppercase tracking-widest font-mono">
                    Department of Computing & Tech
                  </span>
                </div>
                <div className="space-y-2">
                  {courses.filter(c => c.departmentId === 'computing').map(c => {
                    const isSelected = c.id === activeCourseId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveCourseId(c.id);
                          setUnitEditingCategory(null);
                        }}
                        className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-600 text-slate-900 shadow-sm ring-1 ring-indigo-600 pl-3.5 border-l-4 border-l-indigo-600'
                            : 'bg-slate-50/55 border-slate-200 text-slate-700 hover:bg-slate-100/60 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wider ${
                              isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-650'
                            }`}>
                              {c.code}
                            </span>
                            {c.programId && (
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                                isSelected ? 'bg-indigo-100/70 text-indigo-800' : 'bg-slate-200/75 text-slate-600'
                              }`}>
                                {c.programId.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950 font-extrabold' : 'text-slate-800'}`}>
                            {c.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {c.creditHours} Cr. Hr • {c.students.length} Students
                          </p>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCourse(c);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-605 transition-colors cursor-pointer"
                            title="Edit Course Specification"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(c.id);
                            }}
                            className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Course Specification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {courses.filter(c => c.departmentId === 'computing').length === 0 && (
                    <p className="text-[10px] text-slate-400 italic py-2 pl-1 select-none font-sans font-medium">No Computing courses defined.</p>
                  )}
                </div>
              </div>

              {/* DEPARTMENT: BUSINESS ADMINISTRATION */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 border-b border-rose-100 pb-1">
                  <span className="w-1.5 h-3 rounded bg-amber-500 shrink-0"></span>
                  <span className="text-[9px] font-extrabold text-amber-950 uppercase tracking-widest font-mono">
                    Department of Business Admin
                  </span>
                </div>
                <div className="space-y-2">
                  {courses.filter(c => c.departmentId === 'business').map(c => {
                    const isSelected = c.id === activeCourseId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveCourseId(c.id);
                          setUnitEditingCategory(null);
                        }}
                        className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-50/15 border-amber-600 text-slate-900 shadow-sm ring-1 ring-amber-600 pl-3.5 border-l-4 border-l-amber-500'
                            : 'bg-slate-50/55 border-slate-200 text-slate-700 hover:bg-slate-100/60 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wider ${
                              isSelected ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-650'
                            }`}>
                              {c.code}
                            </span>
                            {c.programId && (
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                                isSelected ? 'bg-amber-100/70 text-amber-900' : 'bg-slate-200/75 text-slate-650'
                              }`}>
                                {c.programId.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-950 font-extrabold' : 'text-slate-800'}`}>
                            {c.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {c.creditHours} Cr. Hr • {c.students.length} Students
                          </p>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCourse(c);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-605 transition-colors cursor-pointer"
                            title="Edit Course Specification"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(c.id);
                            }}
                            className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Course Specification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {courses.filter(c => c.departmentId === 'business').length === 0 && (
                    <p className="text-[10px] text-slate-400 italic py-2 pl-1 select-none font-sans font-medium">No Business courses defined.</p>
                  )}
                </div>
              </div>

              {/* DEFINED COURSE ACTION */}
              <button
                onClick={() => setIsAddingCourse(true)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-250 hover:border-indigo-600 hover:bg-indigo-50/10 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Define Course Specification</span>
              </button>

            </div>

            {/* RIGHT COLUMN: MAIN OUTCOME ASSESSMENT INTERFACES */}
            <div className="lg:col-span-8 space-y-6">
              
              {selectedCourse ? (
                <>
                  {/* INSTRUCTOR CONTENT HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-350 pb-3 gap-3">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
                        <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                        {selectedCourse.code} — {selectedCourse.title}
                      </h2>
                      <p className="text-xs text-slate-500 font-sans mt-0.5">
                        ResultMate evaluation engine is currently running course outcome assessments.
                      </p>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-655 bg-slate-100 border border-slate-205 rounded px-3 py-1">
                      Assessing {selectedCourse.students.length} enrolled students.
                    </div>
                  </div>

                  {/* TAB PANES */}
                  <div className="bg-white/85 border border-slate-200/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-md text-slate-800">
              
              {/* TAB 1: SET WEIGHTAGE */}
              {activeTab === 'weightage' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      Set Marks distribution Weightage
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Set total distribution percentages for each criteria. Total must sum up to exactly <strong className="text-indigo-950">100.00%</strong>. Use the control below the grid to make adjustments.
                    </p>
                  </div>

                  {/* Weightage Data Grid */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="py-2.5 px-4 w-12 text-center">Sel</th>
                            <th className="py-2.5 px-4">Marks Title</th>
                            <th className="py-2.5 px-4 text-center">Percentage</th>
                            <th className="py-2.5 px-4 text-center">No of Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {tempCategories.map((item, idx) => (
                            <tr
                              key={item.name}
                              onClick={() => setSelectedWeightIndex(idx)}
                              className={`cursor-pointer transition-colors ${
                                selectedWeightIndex === idx
                                  ? 'bg-indigo-50/70 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center">
                                  {selectedWeightIndex === idx ? (
                                    <span className="text-indigo-600 text-[10px]">▶</span>
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-sans text-slate-800">
                                {item.name}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-indigo-600">
                                {item.percentage}%
                              </td>
                              <td className="py-3 px-4 text-center text-slate-600">
                                {item.units}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-800">
                            <td colSpan={2} className="py-3 px-4 text-right pr-12 font-sans text-slate-600">
                              Total Distribution Percentage:
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
                                currentTotalWeight === 100
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                  : 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                              }`}>
                                {currentTotalWeight.toFixed(2)}%
                              </span>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Row Editor Card */}
                  {tempCategories[selectedWeightIndex] && (
                    <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                        <span className="text-xs font-mono text-indigo-600 uppercase tracking-widest font-bold">
                          Active Component Editor
                        </span>
                        <span className="text-xs font-bold text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                          {tempCategories[selectedWeightIndex].name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold font-mono">
                            Category Percentage (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editWeightPercent}
                            onChange={(e) => handleWeightPercentChange(e.target.value)}
                            className="bg-white text-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-150 outline-none w-full font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1 font-sans">
                            Portion of the student's final aggregate allocated to this criteria.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold font-mono">
                            Number of Units
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={editWeightUnits}
                            onChange={(e) => handleWeightUnitsChange(e.target.value)}
                            className="bg-white text-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-150 outline-none w-full font-mono"
                          />
                          <p className="text-[10px] text-slate-500 mt-1 font-sans">
                            Number of sessions (e.g. 5 Assignments or 6 Quizzes). Adjust to generate rows.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
                        <button
                          onClick={handleUpdateCategorySingle}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Update Row Values
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submission and reset actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                      Changes made above take immediate effect upon selecting "Ok".
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetWeightage}
                        className="px-5 py-2 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAllWeightage}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Ok
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: EDIT ITEMS */}
              {activeTab === 'edit-items' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      Configure Category Unit Marks Details
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Choose an assessment item below to adjust each individual unit's passing thresholds and relative weights. Items set to 0% cannot have unit configs.
                    </p>
                  </div>

                  {/* Categories Selector list representing the dropdown items visually */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedCourse.categories.map(cat => {
                      const hasWeight = cat.percentage > 0;
                      return (
                        <div
                          key={cat.name}
                          onClick={() => handleOpenUnitEditor(cat.name)}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                            hasWeight
                              ? 'bg-white border-slate-200 hover:border-indigo-600/80 hover:bg-slate-50/50 hover:shadow-sm relative overflow-hidden group'
                              : 'bg-slate-100/40 border-dashed border-slate-300 opacity-60 hover:opacity-100 hover:border-slate-400'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                              {cat.name}
                            </h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                              hasWeight ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {cat.percentage}% Weight
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 font-mono">
                            <span>Units: {cat.units}</span>
                            <span className="text-indigo-650 opacity-0 group-hover:opacity-100 font-bold transition-opacity font-sans">
                              Edit Units &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
                    <h4 className="font-semibold text-slate-850 mb-1.5 flex items-center gap-1.5 font-sans">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                      Assessment Design Principle
                    </h4>
                    Each individual unit item can store unique Passing Marks and Total Marks thresholds separate from one another. This allows you to construct modular, complex scorecards where student achievements are evaluated dynamically against course objectives.
                  </div>

                </div>
              )}

              {/* TAB 3: REGISTER STUDENTS */}
              {activeTab === 'students' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Add Student
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Define students enrolled in this course specification. Enrollment requires the <strong className="text-indigo-950 font-bold">registration number</strong> as the unique identifier.
                      </p>
                    </div>

                    <div className="text-xs bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 font-mono text-indigo-700 font-bold self-start sm:self-auto shadow-xs">
                      Total Course Strengths: {selectedCourse.students.length} Enrolled
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* ENROLL FORM */}
                    <div className="lg:col-span-4 space-y-6">
                      
                      <form onSubmit={handleAddNewStudent} className="bg-[#f8fafc] p-4 rounded-xl border border-slate-205 shadow-xs space-y-4">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-indigo-950 border-b border-slate-200 pb-2">
                          Single Enrollment
                        </h4>

                        <div>
                          <label className="block text-[10px] text-slate-600 uppercase font-mono font-bold mb-1">
                            Registration Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. FA-2017/BS EE-045"
                            value={newStudentReg}
                            onChange={(e) => setNewStudentReg(e.target.value)}
                            className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-slate-950 text-xs w-full outline-none focus:ring-2 focus:ring-indigo-150 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-600 uppercase font-mono font-bold mb-1">
                            Student Name (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Muhammad Ali"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-slate-950 text-xs w-full outline-none focus:ring-2 focus:ring-indigo-150"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          Enroll Student
                        </button>
                      </form>

                      {/* BULK UPLOAD FORM (Excel Sheet Import) */}
                      <div className="bg-[#f8fafc] p-4 rounded-xl border border-slate-205 shadow-xs space-y-4 font-sans text-slate-800">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-indigo-950 border-b border-slate-200 pb-2 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          Import from Excel / CSV Sheet
                        </h4>

                        {!fileName ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('excel-file-picker')?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                              isDragging 
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 scale-[1.01]' 
                                : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              id="excel-file-picker"
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <Upload className={`w-8 h-8 transition-transform duration-200 ${isDragging ? 'text-indigo-600 animate-bounce' : 'text-slate-400'}`} />
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Click to select or drag & drop excel file
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                Supports Excel (.xlsx, .xls) and CSV (.csv) stylesheets
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate" title={fileName}>
                                    {fileName}
                                  </p>
                                  <p className="text-[10px] text-emerald-600 font-semibold font-mono">
                                    {parsedStudents.length} student records parsed successfully
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setFileName('');
                                  setParsedStudents([]);
                                }}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors text-[10px] font-bold font-mono cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>

                            {parsedStudents.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">
                                  Preview (First 3 parsed rows)
                                </p>
                                <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                                  <table className="w-full text-left text-[10px] font-sans">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-655 font-bold border-b border-slate-200">
                                        <th className="py-1 px-2.5">Reg Number</th>
                                        <th className="py-1 px-2.5">Student Name</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono text-slate-705">
                                      {parsedStudents.slice(0, 3).map((std, i) => (
                                        <tr key={i}>
                                          <td className="py-1 px-2.5 font-bold uppercase text-indigo-900">{std.regNo}</td>
                                          <td className="py-1 px-2.5 max-w-[120px] truncate">{std.name}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {parsedStudents.length > 3 && (
                                    <p className="text-[9px] text-slate-500 italic p-1 bg-white text-center border-t border-slate-100 border-b">
                                      ... and {parsedStudents.length - 3} more student records
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            <button
                              onClick={handleExcelImportExecute}
                              disabled={parsedStudents.length === 0}
                              className={`w-full py-2 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs border text-center ${
                                parsedStudents.length > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              Enroll parsed students
                            </button>
                          </div>
                        )}

                        <div className="bg-amber-50/85 border-l-4 border-amber-500 p-2.5 rounded text-[10px] text-amber-900 leading-relaxed max-w-full">
                          <strong className="font-bold flex items-center gap-1 text-amber-955 mb-0.5 uppercase tracking-wide">
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                            Format requirement:
                          </strong>
                          Sheet layout must have <strong className="font-bold font-mono">Registration No</strong> as column 1 (Column A) and <strong className="font-bold font-mono text-xs">Student Name</strong> as column 2 (Column B). Header row is skipped automatically.
                        </div>
                      </div>

                    </div>

                    {/* ENROLLED MATRIX */}
                    <div className="lg:col-span-8 bg-white rounded-xl border border-slate-205 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-slate-705 border-b border-slate-200 font-bold">
                            <th className="py-2.5 px-4 w-12 text-center">S.#</th>
                            <th className="py-2.5 px-4 font-sans">Registration No.</th>
                            <th className="py-2.5 px-4 font-sans">Student Name</th>
                            <th className="py-2.5 px-4 text-center w-28 font-sans">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {selectedCourse.students.map((student, index) => {
                            const isEditing = editingStudentReg === student.regNo;
                            return (
                              <tr key={student.regNo} className={isEditing ? "bg-indigo-50/40" : "hover:bg-slate-55"}>
                                <td className="py-3 px-4 text-center text-slate-400 font-mono">
                                  {index + 1}
                                </td>
                                {isEditing ? (
                                  <>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={editStudentRegVal}
                                        onChange={(e) => setEditStudentRegVal(e.target.value)}
                                        className="bg-white border border-slate-300 rounded px-2 py-1 text-indigo-700 font-bold font-mono text-[11px] w-full focus:ring-2 focus:ring-indigo-400 outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleUpdateStudentDetail(student.regNo);
                                          if (e.key === 'Escape') handleCancelEditStudent();
                                        }}
                                        autoFocus
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={editStudentNameVal}
                                        onChange={(e) => setEditStudentNameVal(e.target.value)}
                                        className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-sans text-xs w-full focus:ring-2 focus:ring-indigo-400 outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleUpdateStudentDetail(student.regNo);
                                          if (e.key === 'Escape') handleCancelEditStudent();
                                        }}
                                      />
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => handleUpdateStudentDetail(student.regNo)}
                                          className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 transition-all font-sans cursor-pointer"
                                          title="Save changes"
                                        >
                                          <Check className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                        <button
                                          onClick={handleCancelEditStudent}
                                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-all font-sans cursor-pointer"
                                          title="Cancel edit"
                                        >
                                          <X className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-4 text-indigo-650 font-bold font-mono text-[11px]">
                                      {student.regNo}
                                    </td>
                                    <td className="py-3 px-4 font-sans text-slate-800">
                                      {student.name}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleStartEditStudent(student)}
                                          className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition-all font-sans cursor-pointer"
                                          title="Edit student details"
                                        >
                                          <Pencil className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                        <button
                                          onClick={() => handleUnenrollStudent(student.regNo)}
                                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-all font-sans cursor-pointer"
                                          title="Unenroll student"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                                No students enrolled yet. Register students to view the assessment grid.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 4: GRADE SHEETS */}
              {activeTab === 'grade' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                        Outcome Marks Entry Ledger
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        View course total outputs from the assessment ledger. Scores dynamically update as unit specs alter.
                      </p>
                    </div>

                    <button
                      onClick={handleExportCourseSheet}
                      className="px-3 py-1.5 border border-slate-300 text-slate-755 hover:bg-slate-100 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      Export Excel
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-205 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-4 w-12 text-center">S.#</th>
                            <th className="py-2.5 px-4">Registration No.</th>
                            <th className="py-2.5 px-4">Student Name</th>
                            {selectedCourse.categories.filter(c => c.percentage > 0).map(cat => (
                              <th key={cat.name} className="py-2.5 px-4 text-center font-mono">
                                {cat.name} <span className="text-[10px] text-slate-500 block">({cat.percentage}%)</span>
                              </th>
                            ))}
                            <th className="py-2.5 px-4 text-center font-bold text-indigo-650 font-sans">Total (100)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {selectedCourse.students.map((std, idx) => {
                            const activeCats = selectedCourse.categories.filter(c => c.percentage > 0);
                            
                            let aggregate = 0;
                            const catGrades = activeCats.map(cat => {
                              let catSum = 0;
                              const existingUnits = selectedCourse.unitsData[cat.name] || [];
                              if (cat.units > 0) {
                                for (let u = 1; u <= cat.units; u++) {
                                  const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
                                  const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                                  const weightage = matchingUnit ? matchingUnit.weightage : (100 / cat.units);
                                  
                                  const mark = getStudentMark(std, cat.name, u, totalMarks);
                                  if (totalMarks > 0) {
                                    catSum += (mark / totalMarks) * weightage;
                                  }
                                }
                              }
                              const categoryContribution = (catSum / 100) * cat.percentage;
                              aggregate += categoryContribution;
                              return parseFloat(categoryContribution.toFixed(1));
                            });

                            return (
                              <tr key={std.regNo} className="hover:bg-slate-55">
                                <td className="py-3 px-4 text-center text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 text-indigo-650 font-bold text-[11px]">
                                  {std.regNo}
                                </td>
                                <td className="py-3 px-4 font-sans text-slate-800">
                                  {std.name}
                                </td>
                                {catGrades.map((gradeScore, cIdx) => (
                                  <td key={cIdx} className="py-3 px-4 text-center text-slate-800 font-semibold font-mono">
                                    {gradeScore}
                                  </td>
                                ))}
                                <td className="py-3 px-4 text-center font-bold text-indigo-755 bg-indigo-50/50">
                                  {aggregate.toFixed(1)} / 100
                                </td>
                              </tr>
                            );
                          })}
                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={4 + selectedCourse.categories.filter(c => c.percentage > 0).length} className="py-8 text-center text-slate-500 font-sans">
                                Enrolled student list is currently empty. Run student additions.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 5: MARKS ENTRY LEDGER */}
              {activeTab === 'marks-entry' && selectedCourse && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1e4e79] flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
                        Outcome Assessment Marks Entry Ledger
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Interact directly with cells to input and modify student achievements. Click any cell, type, and press <kbd className="bg-slate-100 px-1 border border-slate-300 rounded text-[9px] font-mono">Enter</kbd> or click away to save.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleExportCourseSheet}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Export Sheet
                      </button>
                    </div>
                  </div>

                  {/* ROYAL-BLUE RETRO SYSTEM BANNER */}
                  <div className="bg-[#13426e] border border-[#0d2a4a] text-white p-2 rounded-xl shadow-md font-sans">
                    <div className="grid grid-cols-1 md:grid-cols-12 border border-blue-200/20 text-[11px] font-bold overflow-hidden rounded-lg">
                      {/* Row 1 */}
                      <div className="md:col-span-2 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-b border-blue-200/10">Course Code</div>
                      <div className="md:col-span-2 bg-white text-slate-900 p-2 border-r border-b border-blue-200/10 font-mono text-xs uppercase">{selectedCourse.code}</div>
                      
                      <div className="md:col-span-2 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-b border-blue-200/10">Course Name</div>
                      <div className="md:col-span-4 bg-white text-slate-900 p-2 border-r border-b border-blue-200/10 text-xs font-sans font-semibold">{selectedCourse.title}</div>
                      
                      <div className="md:col-span-1 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-b border-blue-200/10">Semester</div>
                      <div className="md:col-span-1 bg-white text-slate-900 p-2 border-b border-blue-200/10 font-mono text-xs uppercase">Sp-2026</div>

                      {/* Row 2 */}
                      <div className="md:col-span-2 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-blue-200/10">Credit Hours</div>
                      <div className="md:col-span-2 bg-white text-slate-900 p-2 border-r border-blue-200/10 font-mono text-xs">{selectedCourse.creditHours}-0-{selectedCourse.creditHours}</div>
                      
                      <div className="md:col-span-2 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-blue-200/10">Instructor</div>
                      <div className="md:col-span-4 bg-white text-slate-900 p-2 border-r border-blue-200/10 text-xs font-sans font-semibold">{instructorName}</div>
                      
                      <div className="md:col-span-1 bg-[#0c2e50] p-2 text-blue-200/90 border-r border-blue-200/10">Section</div>
                      <div className="md:col-span-1 bg-white text-slate-900 p-2 text-xs font-bold uppercase text-slate-700">All</div>
                    </div>
                  </div>

                  {/* SPREADSHEET LEDGER TABLE */}
                  <div className="bg-white rounded-xl border border-slate-205 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse font-sans min-w-[800px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200 bg-slate-150/50">S.#</th>
                            <th className="py-2.5 px-3 w-40 border-r border-slate-200 font-sans">Roll No</th>
                            <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200">Student Name</th>
                            
                            {tableColumns.map((col, index) => (
                              <th key={`head-${col.categoryName}-${col.unitNo}-${index}`} className="py-2 px-1 text-center border-r border-slate-200 font-mono w-16 bg-slate-50">
                                <span className="block text-indigo-950 font-bold">{col.label}</span>
                                <span className="block text-[8px] text-slate-450 font-normal mt-0.5">Max {col.totalMarks}</span>
                              </th>
                            ))}
                            
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-slate-800 bg-indigo-50/20 w-24">TMarks</th>
                            <th className="py-2.5 px-3 text-center font-bold text-indigo-755 bg-indigo-50/40 w-20">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-705">
                          {selectedCourse.students.map((std, idx) => {
                            const tMarks = calculateStudentCourseTotal(std);
                            const grade = getLetterGrade(tMarks);
                            
                            return (
                              <tr key={`row-${std.regNo}-${idx}`} className="hover:bg-slate-55/60 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 border-r border-slate-150 bg-slate-50/50">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 text-indigo-950 font-bold text-[11px] border-r border-slate-150 truncate">
                                  {std.regNo}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-905 border-r border-slate-150 truncate max-w-[220px]">
                                  {std.name}
                                </td>
                                
                                {tableColumns.map((col, cIdx) => {
                                  const markVal = getStudentMark(std, col.categoryName, col.unitNo, col.totalMarks);
                                  return (
                                    <td key={`cell-${std.regNo}-${col.categoryName}-${col.unitNo}-${cIdx}`} className="py-1 px-1 text-center border-r border-slate-150 bg-white">
                                      <CellInput
                                        initialValue={markVal}
                                        totalMarks={col.totalMarks}
                                        passing={col.passing}
                                        rowIndex={idx}
                                        colIndex={cIdx}
                                        onSave={(newScore) => handleUpdateStudentMark(std.regNo, col.categoryName, col.unitNo, newScore)}
                                      />
                                    </td>
                                  );
                                })}
                                
                                <td className="py-2 px-3 text-center font-bold text-slate-900 border-r border-slate-150 bg-slate-50/50">
                                  {tMarks.toFixed(1)} / 100
                                </td>
                                <td className={`py-2 px-3 text-center font-bold border-r border-slate-150 bg-indigo-50/30 ${
                                  grade === 'F' ? 'text-rose-600 font-extrabold' : 'text-emerald-700 font-extrabold'
                                }`}>
                                  {grade}
                                </td>
                              </tr>
                            );
                          })}

                          {selectedCourse.students.length > 0 && (() => {
                            const stdCount = selectedCourse.students.length;
                            
                            // 1. Calculate Average row counts
                            const colAverages = tableColumns.map(col => {
                              const sum = selectedCourse.students.reduce((acc, s) => {
                                return acc + getStudentMark(s, col.categoryName, col.unitNo, col.totalMarks);
                              }, 0);
                              return parseFloat((sum / stdCount).toFixed(2));
                            });

                            const tMarksAverage = parseFloat((selectedCourse.students.reduce((acc, s) => {
                              return acc + calculateStudentCourseTotal(s);
                            }, 0) / stdCount).toFixed(2));

                            return (
                              <>
                                {/* FORMULA 1: AVERAGE ROW */}
                                <tr className="bg-red-50/45 text-slate-900 font-bold border-t-2 border-slate-300">
                                  <td className="py-2.5 px-3 text-center text-rose-800 bg-red-100/40 border-r border-slate-200">
                                    F1
                                  </td>
                                  <td className="py-2.5 px-3 text-rose-950 text-xs font-bold border-r border-slate-200">
                                    Average
                                  </td>
                                  <td className="py-2.5 px-3 font-sans text-rose-900 border-r border-slate-200 italic">
                                    Class Outcome Average
                                  </td>
                                  {colAverages.map((avg, i) => (
                                    <td key={`avg-${i}`} className="py-2 px-1 text-center border-r border-slate-200 text-indigo-900 font-mono text-[11px]">
                                      {avg.toFixed(2)}
                                    </td>
                                  ))}
                                  <td className="py-2.5 px-3 text-center border-r border-slate-200 text-indigo-900 text-xs font-mono font-bold bg-[#f1f5f9]">
                                    {tMarksAverage.toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center bg-[#f1f5f9]">
                                    -
                                  </td>
                                </tr>
                              </>
                            );
                          })()}

                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={5 + tableColumns.length} className="py-12 bg-slate-50/50 text-center text-slate-505 font-sans">
                                <FileSpreadsheet className="w-8 h-8 text-slate-350 mx-auto mb-2 animate-pulse" />
                                <h5 className="font-bold text-slate-700">Student Register is empty</h5>
                                <p className="text-[10px] text-slate-500 mt-1">Please enroll students via "Add Student" tab to populate and edit marks ledger entries.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 font-sans shadow-xs">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
            <h4 className="font-bold text-slate-700">No Target Course Selected</h4>
            <p className="text-xs text-slate-500 mt-1">Please select an assigned course from the sidebar to view outcomes and student registers.</p>
          </div>
        )}

            </div>
          </div>
        )}

      </main>

      {/* FOOTER METADATA */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>&copy; Iqra University Outcome Based Education (OBE) Management System. All rights reserved.</p>
        <p className="text-[10px] text-slate-400 mt-1 font-mono font-semibold">ResultMate Software Suite v4.6 Integration Sandbox</p>
      </footer>


      {/* WINDOWS-STYLE DIALOG WARNING / ALERT MODAL (Accurate to Screenshot #4) */}
      <AnimatePresence>
        {showZeroAlert?.show && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900 font-sans"
            >
              {/* Header block resembling standard Win11 popups */}
              <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-bold text-slate-850">Invalid percentage distribution</span>
                <button
                  onClick={() => setShowZeroAlert(null)}
                  className="text-slate-400 hover:text-slate-900 text-sm font-semibold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Message block */}
              <div className="p-6 flex items-start gap-4">
                <div className="p-2 bg-amber-50 rounded-full text-amber-600 shrink-0 border border-amber-100">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-slate-700 leading-relaxed font-sans pt-1 font-medium">
                    {showZeroAlert.msg}
                  </p>
                </div>
              </div>

              {/* Action row with matching OK styling */}
              <div className="bg-slate-50 px-4 py-3 flex justify-end border-t border-slate-200">
                <button
                  onClick={() => setShowZeroAlert(null)}
                  className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm outline-none transition-all cursor-pointer"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* SET MARKS UNIT MODAL - Restyled to white background and note removed */}
      <AnimatePresence>
        {unitEditingCategory && selectedCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-800 font-sans"
            >
              
              {/* Modern Title Bar with Slate-50 Background */}
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Set Marks Unit ({unitEditingCategory})
                </span>
                <button
                  onClick={() => setUnitEditingCategory(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 font-semibold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-5 space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Left Column: Data Grid Table */}
                  <div className="md:col-span-9 space-y-2">
                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                            <th className="py-2 px-2.5 w-8"></th>
                            <th className="py-2 px-2.5">Unit No</th>
                            <th className="py-2 px-2.5 text-center">Passing</th>
                            <th className="py-2 px-2.5 text-center">Total Marks</th>
                            <th className="py-2 px-2.5 text-center">Weightage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-slate-700 font-medium">
                          {tempUnits.map((unit, uIdx) => {
                            const isSelected = selectedUnitIndex === uIdx;
                            return (
                              <tr
                                key={unit.unitNo}
                                onClick={() => setSelectedUnitIndex(uIdx)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-50/70 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2 px-2.5 text-center text-indigo-600">
                                  {isSelected ? '▶' : ''}
                                </td>
                                <td className="py-2 px-2.5 font-bold">
                                  {unit.unitNo}
                                </td>
                                <td className="py-2 px-2.5 text-center text-emerald-600 font-bold">
                                  {unit.passing}
                                </td>
                                <td className="py-2 px-2.5 text-center text-sky-600 font-bold">
                                  {unit.totalMarks}
                                </td>
                                <td className={`py-2 px-2.5 text-center font-extrabold ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}>
                                  {unit.weightage}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600">
                      <span>No of Best Units: <strong className="text-slate-800">0</strong></span>
                      <span>Total Weights Sum: <strong className="text-indigo-600 font-bold">{totalUnitWeightSum}%</strong></span>
                    </div>
                  </div>

                  {/* Right Column: Grid Action Buttons */}
                  <div className="md:col-span-3 flex flex-row md:flex-col gap-2 justify-center">
                    <button
                      onClick={handleAddUnitRow}
                      className="grow md:grow-0 py-2 px-4 bg-white hover:bg-slate-50 text-slate-850 border border-slate-250 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Add
                    </button>
                    <button
                      onClick={handleRemoveUnitRow}
                      className="grow md:grow-0 py-2 px-4 bg-white hover:bg-slate-50 text-slate-850 border border-slate-250 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Remove
                    </button>
                  </div>

                </div>

                {/* Bottom Section: Editor Card for highlighted row */}
                {tempUnits[selectedUnitIndex] && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                    <h4 className="text-xs uppercase tracking-wider font-bold text-slate-700 border-b border-slate-250 pb-1.5 font-mono">
                      {unitEditingCategory} # {tempUnits[selectedUnitIndex].unitNo} Configurer
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-mono font-bold mb-1">
                          Total Marks
                        </label>
                        <input
                          type="number"
                          value={unitTotalMarks}
                          onChange={(e) => handleUnitTotalMarksChange(e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 w-full font-mono outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 font-mono font-bold mb-1">
                          Pass Marks
                        </label>
                        <input
                          type="number"
                          value={unitPassMarks}
                          onChange={(e) => handleUnitPassMarksChange(e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 w-full font-mono outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] text-slate-500 font-mono font-bold mb-1">
                          Weightage (%)
                        </label>
                        <input
                          type="number"
                          value={unitWeightage}
                          onChange={(e) => handleUnitWeightageChange(e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 w-full font-mono outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleUpdateUnitSingle}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Update
                      </button>
                    </div>

                  </div>
                )}

              </div>

              {/* OK and Cancel final Submission */}
              <div className="bg-slate-50 px-5 py-4 flex justify-end gap-2 border-t border-slate-200">
                <button
                  onClick={() => setUnitEditingCategory(null)}
                  className="px-5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUnitSettings}
                  className="px-6 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  Ok
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* CREATE NEW COURSE DRAWER / DIALOG SHEET */}
      <AnimatePresence>
        {isAddingCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5 font-sans">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Define Course Specification
                </h3>
                <button
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  onClick={() => setIsAddingCourse(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddNewCourse} className="p-6 space-y-4 font-sans">
                
                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    DEPARTMENT ASSOCIATE *
                  </label>
                  <select
                    value={addDeptId}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setAddDeptId(dept);
                      setAddProgramId(dept === 'computing' ? 'bscs' : 'bba');
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    <option value="computing">Department of Computing and Technology</option>
                    <option value="business">Department of Business Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    EDUCATIONAL PROGRAM *
                  </label>
                  <select
                    value={addProgramId}
                    onChange={(e) => setAddProgramId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    {(DEPARTMENT_PROGRAMS[addDeptId] || []).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    COURSE CODE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-301, BBA-402"
                    value={addCourseCode}
                    onChange={(e) => setAddCourseCode(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    COURSE TITLE / NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Quality Assurance"
                    value={addCourseTitle}
                    onChange={(e) => setAddCourseTitle(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    CREDIT HOURS (CR. HR)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={addCreditHours}
                    onChange={(e) => setAddCreditHours(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddingCourse(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Register Course
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* EDIT EXISTING COURSE DRAWER / DIALOG SHEET */}
      <AnimatePresence>
        {isEditingCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between font-sans">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Edit Course Specification
                </h3>
                <button
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  onClick={() => setIsEditingCourse(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateCourse} className="p-6 space-y-4 font-sans">
                
                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    DEPARTMENT ASSOCIATE *
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setEditDeptId(dept);
                      setEditProgramId(dept === 'computing' ? 'bscs' : 'bba');
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    <option value="computing">Department of Computing and Technology</option>
                    <option value="business">Department of Business Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    EDUCATIONAL PROGRAM *
                  </label>
                  <select
                    value={editProgramId}
                    onChange={(e) => setEditProgramId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    {(DEPARTMENT_PROGRAMS[editDeptId] || []).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    COURSE CODE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-301, BBA-402"
                    value={editCourseCode}
                    onChange={(e) => setEditCourseCode(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    COURSE TITLE / NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Quality Assurance"
                    value={editCourseTitle}
                    onChange={(e) => setEditCourseTitle(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    CREDIT HOURS (CR. HR)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={editCreditHours}
                    onChange={(e) => setEditCreditHours(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditingCourse(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* DELETE COURSE SPECIFICATION CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {courseToDeleteId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-rose-200 rounded-2xl w-full max-w-sm overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center gap-2 font-sans">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-rose-950">
                  Delete Specification
                </h3>
              </div>
              <div className="p-6 space-y-4 font-sans text-xs text-slate-650 leading-relaxed">
                <p>
                  Are you sure you want to stop teaching this course? This action is permanent and will completely reset the course weightage profile, exam items, and registered students roster from your workspace.
                </p>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setCourseToDeleteId(null)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteCourse}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
