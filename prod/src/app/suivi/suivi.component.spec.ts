import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuiviComponent } from './suivi.component';

describe('SuiviComponent', () => {
  let component: SuiviComponent;
  let fixture: ComponentFixture<SuiviComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuiviComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SuiviComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
