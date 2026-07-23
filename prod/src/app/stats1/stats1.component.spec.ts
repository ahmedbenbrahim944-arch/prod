import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Stats1Component } from './stats1.component';

describe('Stats1Component', () => {
  let component: Stats1Component;
  let fixture: ComponentFixture<Stats1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Stats1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Stats1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
