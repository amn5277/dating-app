import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { useAuthStore } from '../../store/auth';
import { profileAPI } from '../../utils/api';
import { Interest } from '../../store/auth';

interface ProfileForm {
  name: string;
  age: number;
  gender: string;
  location: string;
  bio: string;
  extroversion: number;
  openness: number;
  conscientiousness: number;
  agreeableness: number;
  neuroticism: number;
  looking_for: string;
  min_age: number;
  max_age: number;
  max_distance: number;
}

const ProfileCreation: React.FC = () => {
  const navigate = useNavigate();
  const { setProfile, setLoading } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [isEditingExistingProfile, setIsEditingExistingProfile] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    defaultValues: {
      extroversion: 5,
      openness: 5,
      conscientiousness: 5,
      agreeableness: 5,
      neuroticism: 5,
      min_age: 18,
      max_age: 35,
      max_distance: 50,
    },
  });

  const totalSteps = 4;

  // Load interests and check for existing profile on component mount
  useEffect(() => {
    loadInterests();
    checkExistingProfile();
  }, []);
  
  const checkExistingProfile = async () => {
    try {
      console.log('🔍 Checking for existing profile...');
      const response = await profileAPI.get();
      console.log('✅ Found existing profile:', response.data);
      
      // Pre-populate form with existing data
      const profile = response.data;
      setValue('name', profile.name || '');
      setValue('age', profile.age || 25);
      setValue('gender', profile.gender || '');
      setValue('location', profile.location || '');
      setValue('bio', profile.bio || '');
      setValue('extroversion', profile.extroversion || 5);
      setValue('openness', profile.openness || 5);
      setValue('conscientiousness', profile.conscientiousness || 5);
      setValue('agreeableness', profile.agreeableness || 5);
      setValue('neuroticism', profile.neuroticism || 5);
      setValue('looking_for', profile.looking_for || '');
      setValue('min_age', profile.min_age || 18);
      setValue('max_age', profile.max_age || 35);
      setValue('max_distance', profile.max_distance || 50);
      
      // Set interests if available
      if (profile.interests) {
        setSelectedInterests(profile.interests.map((interest: any) => interest.id));
      }
      
      setIsEditingExistingProfile(true);
      
    } catch (error: any) {
      // No profile found - that's okay, we'll create a new one
      console.log('ℹ️  No existing profile found - creating new profile');
      setIsEditingExistingProfile(false);
    }
  };

  const loadInterests = async () => {
    try {
      const response = await profileAPI.getInterests();
      setInterests(response.data);
      
      // If no interests exist, seed them
      if (response.data.length === 0) {
        await profileAPI.seedInterests();
        const newResponse = await profileAPI.getInterests();
        setInterests(newResponse.data);
      }
    } catch (error) {
      console.error('Failed to load interests:', error);
      toast.error('Failed to load interests');
    } finally {
      setLoadingInterests(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    try {
      setLoading(true);
      
      console.log('Form data received:', data); // Debug log
      
      // Validate required fields - check for empty strings and proper values
      if (!data.name || data.name.trim() === '') {
        toast.error('Please enter your name');
        return;
      }
      
      // Validate age (should be a number due to valueAsNumber: true)
      if (!data.age || data.age < 18 || data.age > 100) {
        toast.error('Please enter a valid age (18-100)');
        return;
      }
      
      if (!data.gender || data.gender === '') {
        toast.error('Please select your gender');
        return;
      }
      
      if (!data.looking_for || data.looking_for === '') {
        toast.error('Please select what you are looking for');
        return;
      }
      
      // Transform and validate data
      const profileData = {
        ...data,
        age: data.age || 25, // Should already be a number
        min_age: data.min_age || 18,
        max_age: data.max_age || 35,
        max_distance: data.max_distance || 50,
        interest_ids: selectedInterests,
      };
      
      // Validate age ranges
      if (profileData.age < 18 || profileData.age > 100) {
        toast.error('Age must be between 18 and 100');
        return;
      }
      
      if (selectedInterests.length < 3) {
        toast.error('Please select at least 3 interests');
        return;
      }
      
      console.log('Submitting profile data:', profileData); // Debug log
      
      // Check if profile already exists and use appropriate endpoint
      let response;
      try {
        // First try to get existing profile
        await profileAPI.get();
        console.log('📝 Updating existing profile...');
        response = await profileAPI.update(profileData);
        toast.success('Profile updated successfully!');
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          // No profile exists, create new one
          console.log('✨ Creating new profile...');
          response = await profileAPI.create(profileData);
          toast.success('Profile created successfully!');
        } else {
          // Some other error occurred
          throw getError;
        }
      }
      
      console.log('🎯 ProfileCreation: Setting profile in store:', response.data);
      setProfile(response.data);
      
      // Verify profile was set
      setTimeout(() => {
        const currentState = useAuthStore.getState();
        console.log('🎯 ProfileCreation: Profile verification after setting:', {
          hasProfile: !!currentState.profile,
          profileId: currentState.profile?.id,
          profileName: currentState.profile?.name
        });
      }, 50);
      
      console.log('🧭 ProfileCreation: Navigating to dashboard...');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Profile operation error:', error);
      if (error.response?.data?.detail) {
        const action = isEditingExistingProfile ? 'update' : 'creation';
        toast.error(`Profile ${action} failed: ${JSON.stringify(error.response.data.detail)}`);
      } else {
        const action = isEditingExistingProfile ? 'update' : 'create';
        toast.error(`Failed to ${action} profile. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleInterest = (interestId: number) => {
    setSelectedInterests(prev => 
      prev.includes(interestId) 
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const personalityTraits = [
    {
      name: 'extroversion',
      label: 'Extroversion',
      description: 'How outgoing and social are you?',
      low: 'Introverted',
      high: 'Extroverted'
    },
    {
      name: 'openness',
      label: 'Openness',
      description: 'How open are you to new experiences?',
      low: 'Traditional',
      high: 'Creative'
    },
    {
      name: 'conscientiousness',
      label: 'Conscientiousness',
      description: 'How organized and responsible are you?',
      low: 'Spontaneous',
      high: 'Organized'
    },
    {
      name: 'agreeableness',
      label: 'Agreeableness',
      description: 'How cooperative and trusting are you?',
      low: 'Competitive',
      high: 'Cooperative'
    },
    {
      name: 'neuroticism',
      label: 'Emotional Stability',
      description: 'How well do you handle stress?',
      low: 'Calm',
      high: 'Sensitive'
    }
  ];

  const groupedInterests = interests.reduce((acc, interest) => {
    if (!acc[interest.category]) {
      acc[interest.category] = [];
    }
    acc[interest.category].push(interest);
    return acc;
  }, {} as Record<string, Interest[]>);

  if (loadingInterests) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
        <div className="glass-morphism p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-700 mt-4 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-white/80 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="glass-morphism p-8 rounded-2xl shadow-2xl"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {isEditingExistingProfile ? 'Update your basic information' : 'Tell us about yourself'}
                </h2>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name
                      </label>
                      <input
                        {...register('name', { required: 'Name is required' })}
                        className="input-field"
                        placeholder="Your first name"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Age
                      </label>
                      <input
                        {...register('age', { 
                          required: 'Age is required',
                          valueAsNumber: true,
                          min: { value: 18, message: 'Must be at least 18' },
                          max: { value: 100, message: 'Must be under 100' }
                        })}
                        type="number"
                        min="18"
                        max="100"
                        className="input-field"
                        placeholder="25"
                      />
                      {errors.age && (
                        <p className="mt-1 text-sm text-red-600">{errors.age.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select {...register('gender', { required: 'Gender is required' })} className="input-field">
                      <option value="">Select your gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      {...register('location')}
                      className="input-field"
                      placeholder="City, State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      {...register('bio')}
                      rows={4}
                      className="input-field"
                      placeholder="Tell us a little about yourself..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Personality Traits */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Personality</h2>
                <p className="text-gray-600 mb-6">Rate yourself on these personality traits (1-10 scale)</p>
                
                <div className="space-y-8">
                  {personalityTraits.map((trait) => (
                    <div key={trait.name}>
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            {trait.label}
                          </label>
                          <p className="text-xs text-gray-500">{trait.description}</p>
                        </div>
                        <span className="text-lg font-semibold text-primary-600">
                          {watch(trait.name as keyof ProfileForm) || 5}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-xs text-gray-500 w-20">{trait.low}</span>
                        <input
                          {...register(trait.name as keyof ProfileForm, { min: 1, max: 10 })}
                          type="range"
                          min="1"
                          max="10"
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <span className="text-xs text-gray-500 w-20 text-right">{trait.high}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Interests */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Interests</h2>
                <p className="text-gray-600 mb-6">Select the things you're passionate about</p>
                
                <div className="space-y-6">
                  {Object.entries(groupedInterests).map(([category, categoryInterests]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold text-gray-700 mb-3 capitalize">
                        {category}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categoryInterests.map((interest) => (
                          <button
                            key={interest.id}
                            type="button"
                            onClick={() => toggleInterest(interest.id)}
                            className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              selectedInterests.includes(interest.id)
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-white/50 text-gray-700 hover:bg-white/70'
                            }`}
                          >
                            {interest.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Selected {selectedInterests.length} interests. Choose at least 3 for better matches.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Dating Preferences */}
            {currentStep === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {isEditingExistingProfile ? 'Update your preferences' : 'Dating Preferences'}
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What are you looking for?
                    </label>
                    <select {...register('looking_for', { required: 'This field is required' })} className="input-field">
                      <option value="">Select what you're seeking</option>
                      <option value="serious">Serious relationship</option>
                      <option value="casual">Casual dating</option>
                      <option value="friends">Friends first</option>
                      <option value="networking">Networking</option>
                    </select>
                    {errors.looking_for && (
                      <p className="mt-1 text-sm text-red-600">{errors.looking_for.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Age
                      </label>
                      <input
                        {...register('min_age', { 
                          valueAsNumber: true,
                          min: { value: 18, message: 'Minimum age is 18' },
                          max: { value: 100, message: 'Maximum age is 100' }
                        })}
                        type="number"
                        min="18"
                        max="100"
                        defaultValue="18"
                        className="input-field"
                      />
                      {errors.min_age && (
                        <p className="mt-1 text-sm text-red-600">{errors.min_age.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Age
                      </label>
                      <input
                        {...register('max_age', { 
                          valueAsNumber: true,
                          min: { value: 18, message: 'Minimum age is 18' },
                          max: { value: 100, message: 'Maximum age is 100' }
                        })}
                        type="number"
                        min="18"
                        max="100"
                        defaultValue="35"
                        className="input-field"
                      />
                      {errors.max_age && (
                        <p className="mt-1 text-sm text-red-600">{errors.max_age.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Distance (miles)
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        {...register('max_distance', { 
                          valueAsNumber: true,
                          min: { value: 1, message: 'Minimum distance is 1 mile' },
                          max: { value: 500, message: 'Maximum distance is 500 miles' }
                        })}
                        type="range"
                        min="1"
                        max="500"
                        defaultValue="50"
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <span className="text-sm font-semibold text-primary-600 w-20">
                        {watch('max_distance')} miles
                      </span>
                    </div>
                    {errors.max_distance && (
                      <p className="mt-1 text-sm text-red-600">{errors.max_distance.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  ← Previous
                </button>
              ) : (
                <div></div>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn-primary"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || selectedInterests.length < 3}
                  className="btn-primary flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      {isEditingExistingProfile ? 'Updating Profile...' : 'Creating Profile...'}
                    </>
                  ) : (
                    isEditingExistingProfile ? 'Update Profile' : 'Complete Profile'
                  )}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileCreation;
